const fetch = require("node-fetch")
const fs = require("fs")

let urls = []
let results = []
let done = false
const pageSize = 25

for (let i = 0; i < 500; i++) {
  urls.push(
    "https://addons-ecs.forgesvc.net/api/addon/search" +
      `?categoryId=0&gameId=432&gameVersion=&index=${i *
        pageSize}&pageSize=${pageSize}&searchFilter=&sectionId=6&sort=2`
  )
}

let newDateModified = null
let lastDateModified = null
try {
  lastDateModified = new Date(parseInt(fs.readFileSync("lastDateModified", "utf8"), 10)).getTime()
  newDateModified = lastDateModified
} catch (err) {}

// results is only useful for being notified when the reduction is complete as
// it will only contain the final promise that the array was reduced to
let promises = urls.reduce((accumulatorPromise, nextUrl, index) => {
  return accumulatorPromise.then(() => {
    if (!done) {
      return fetch(nextUrl)
        .then(e => {
          return e.json()
        })
        .then(json => {
          console.log(`found ${json.length} addons`)
          if (json.length < pageSize) {
            done = true
          }
          for (let i = 0; i < json.length; i++) {
            const addon = json[i]
            const addonDateModified = Date.parse(addon.dateModified)
            console.log(`addon: ${addon.slug}`)
            // we don't have a new modified or this modified is newer than the last new modified
            // we always want to have a new modified date
            if (newDateModified === null || addonDateModified > newDateModified) {
              newDateModified = addonDateModified
            }
            // we have a last modified and it's newer than this addon, we're done
            // if we don't have a new modified date, we want the entire list
            if (lastDateModified !== null && lastDateModified > addonDateModified) {
              console.log("addon older than recorded date, finishing")
              done = true
              return results
            } else {
              const filename = `${addon.id}-${addon.slug}.json`
              console.log(`writing json to file ${filename}`)
              fs.writeFileSync(`addons/${filename}`, JSON.stringify(addon))
              return results.push(json)
            }
          }
          // TODO: just return the count here? so we don't make a massive array in memory? (or even just resolve)
        })
    }
  })
}, Promise.resolve())

promises.then(() => {
  if (newDateModified) {
    fs.writeFileSync("lastDateModified", newDateModified.toString())
  }
  console.log(results.length)
})
