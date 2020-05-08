const fetch = require("node-fetch");
const fs = require("fs");
const querystring = require("querystring");

const pageSize = 25;
const addonsDir = "./addons";
const urlGames = "";
const Category = {
  ALL: 0,
};

const Game = {
  Minecraft: 432,
};

const Sort = {
  LastUpdated: 2,
};

const Section = {
  Mods: 6,
};

let urls = [];
let results = [];
let done = false;
let newDateModified = null;
let lastDateModified = null;

// TODO(dmauldin): convert to a generator
for (let i = 0; i < 500; i++) {
  urls.push(
    "https://addons-ecs.forgesvc.net/api/addon/search?" +
      querystring.stringify({
        categoryId: Category.ALL,
        gameId: Game.Minecraft,
        gameVersion: null,
        index: i * pageSize,
        pageSize,
        searchFilter: null,
        sectionId: Section.Mods,
        sort: Sort.LastUpdated,
      })
  );
}

if (!fs.existsSync(addonsDir)) {
  fs.mkdirSync(addonsDir);
}

try {
  lastDateModified = new Date(
    parseInt(fs.readFileSync("lastDateModified", "utf8"), 10)
  ).getTime();
  newDateModified = lastDateModified;
} catch (err) {
  // nothing to do here, really, we just aren't going to set the date because we couldn't find the file
  console.log(`leaves lastDateModified as ${lastDateModified}`);
}

try {
  // results is only useful for being notified when the reduction is complete as
  // it will only contain the final promise that the array was reduced to
  let promises = urls.reduce((accumulatorPromise, nextUrl) => {
    return accumulatorPromise.then(() => {
      if (!done) {
        return fetch(nextUrl)
          .then((e) => {
            return e.json();
          })
          .then((json) => {
            console.log(`found ${json.length} addons`);
            if (json.length < pageSize) {
              // received fewer addons than requested page size = next fetch will have 0
              done = true;
            }
            for (let i = 0; i < json.length; i++) {
              const addon = json[i];
              const addonDateModified = Date.parse(addon.dateModified);
              console.log(
                `addon: ${addon.slug} - dateModified: ${addonDateModified}`
              );
              // set newDateModified to newest date found so far
              if (
                newDateModified === null ||
                addonDateModified > newDateModified
              ) {
                newDateModified = addonDateModified;
              }
              // we have a last modified and it's newer than this addon, we're done
              // if we don't have a new modified date, we want the entire list
              if (
                lastDateModified !== null &&
                lastDateModified > addonDateModified
              ) {
                console.log("addon older than recorded date, finishing");
                done = true;
                return results;
              } else {
                const filename = `${addon.id}-${addon.slug}.json`;
                fs.writeFileSync(`addons/${filename}`, JSON.stringify(addon));
                results.push(json);
              }
            }
            // TODO: just return the count here? so we don't make a massive array in memory? (or even just resolve)
          });
      }
    });
  }, Promise.resolve());
  promises.then(() => {
    if (newDateModified) {
      fs.writeFileSync("lastDateModified", newDateModified.toString());
    }
    console.log(results.length);
  });
} catch (err) {
  console.log(err);
}
