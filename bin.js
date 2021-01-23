#!/usr/bin/env node
const Feedparser = require('feedparser')
const envPaths = require('env-paths')
const fs = require('fs')
const http = require('http-https')
const path = require('path')
const meta = require('./package.json')

const paths = envPaths(meta.name)
const dataPath = paths.data

const feedURL = process.argv[2]
if (!feedURL) {
  process.stdout.write(`
Download and parse Atom/RSS feeds, printing the permalinks of new items.

Usage: list-new-rss-items <URL>
`.trim() + '\n')
  process.exit(1)
}

// Read the list of saved permalinks seen, if any.
const seenPath = path.join(dataPath, encodeURIComponent(feedURL))
let seen
try {
  const read = fs.readFileSync(seenPath, 'utf8')
  seen = JSON.parse(read)
} catch (error) {
  seen = []
}

// Fetch the feed.
http.get(feedURL, (response) => {
  if (response.statusCode !== 200) {
    process.sterr.write(`${feedURL} responded ${response.statusCode}`)
    process.exit(1)
  }
  // Parse the feed.
  const parser = new Feedparser({ feedurl: feedURL })
  parser
    .once('error', (error) => {
      process.stderr.write(error + '\n')
      process.exit(1)
    })
    .once('readable', function () {
      // Process feed items.
      this
        .once('error', (error) => {
          process.stderr.write(error + '\n')
          process.exit(1)
        })
        .on('data', (item) => {
          const permalink = item.permalink
          if (!permalink) {
            process.stderr.write('Item without permalink: ' + JSON.stringify(item))
            return
          }
          // If we haven't seen this permalink before,
          // print it and add it to the list of those we've seen.
          if (!seen.includes(permalink)) {
            process.stdout.write(permalink + '\n')
            seen.push(permalink)
          }
        })
        .once('end', () => {
          // Write our updated list of seen permalinks to disk.
          fs.mkdirSync(path.dirname(seenPath), { recursive: true })
          fs.writeFileSync(seenPath, JSON.stringify(seen))
          process.exit(0)
        })
    })
  response.pipe(parser)
})
