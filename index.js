const fetch = require('node-fetch');
const fs = require('fs');

const pageSize = 25;
const addonsDir = './addons';

let done = false;
let thisRunTimestamp = null;
let lastRunTimestamp = null;
const lastRunTimestampFilename = 'lastRunTimestamp';

// make sure we have an addons directory to write to
if (!fs.existsSync(addonsDir)) {
  fs.mkdirSync(addonsDir);
}

// read or set the last date modified, which determines where we stop making requests
try {
  lastRunTimestamp = new Date(
    parseInt(fs.readFileSync(lastRunTimestampFilename, 'utf8'), 10)
  ).getTime();
} catch (err) {
  lastRunTimestamp = 0;
}

// set the latest modified time to right now, for the next time we run the script
thisRunTimestamp = new Date().getTime();

// TODO(dmauldin): through experimentation, it appears that the query's index
// value must be < 10_000, so we'll need to limit the generator or return some
// value that can be read in the main loop so it knows to stop the queries
// The lowest addon id I read on 5/15/2020 was 220311, which is silents-gems,
// which I know is not the first earliest addon.

/**
 * it actually looks like the index + pageSize cannot be over 10000
 * ie: index=9975&pageSize=25 works, but index=9976&pageSize=25 will return a 500
 */

/**
 * Should be able to get around this issue by separating the requests into
 * categories or game versions (I think sections are for packs, mods, resource
 * packs, etc)
 */

// TODO(dmauldin): create enums (just js objects?) for all of the query params
// TODO(dmauldin): use something like the querystring module to build the query string
//                 from an object

// create and instance a generator so we can just get the next url
const urlGenerator = (function* () {
  let index = 0;
  while (true) {
    console.log(index);
    yield 'https://addons-ecs.forgesvc.net/api/v2/addon/search' +
      `?categoryId=0&gameId=432&gameVersion=&index=${
        index++ * pageSize
      }&pageSize=${pageSize}&searchFilter=&sectionId=6&sort=2`;
  }
})();

// process and write out the addon json
const handleAddon = (addon) => {
  const filename = `${addon.id}-${addon.slug}.json`;
  // TODO(dmauldin): this can probably be async
  fs.writeFileSync(`addons/${filename}`, JSON.stringify(addon));
};

// TODO(dmauldin): this should really be the newest `dateModified` value from all addons
fs.writeFileSync(lastRunTimestampFilename, thisRunTimestamp);

// this is the main loop that fetches from the API until we're fetching old
// data or have no more data to fetch
(async () => {
  while (!done) {
    const url = urlGenerator.next().value;
    // TODO(dmauldin): handle failed fetches (using await instead of promise)
    const res = await fetch(url);
    const addons = await res.json();
    addons.forEach((addon) => {
      handleAddon(addon);
    });
    if (
      addons.length < pageSize ||
      Date.parse(addons[addons.length - 1].dateModified) < lastRunTimestamp
    ) {
      done = true;
    }
  }
})();
