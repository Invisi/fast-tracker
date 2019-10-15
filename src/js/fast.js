/******************************************/
/************ Constants *******************/

const baseURL = 'https://api.guildwars2.com';
const epTokeninfo = '/v2/tokeninfo';
const epCharacters = '/v2/characters';
const epWallet = '/v2/account/wallet';
const epBank = '/v2/account/bank';
const epMaterials = '/v2/account/materials';
const epAccount = '/v2/account';

const neededPermissions = [
"wallet",
"characters",
"account",
"inventories"
];

const possibleFarms = {
  halloween: 'Halloween Lab Farm',
  dragonfall: 'Dragonfall',
  istan: 'Istan',
  forgedchamptrain: 'Forged Champtrain',
  metatrain: 'Gemstone / LS Meta Train',
  doricleather: 'Doric Leather Farm',
  swriba: 'Silverwastes RIBA'
}

const possibleBags = {
  lostsaddlebags: 'Lost Saddlebag',
  phylactery: 'Palawan Phylactery',
  forgedcomponents: 'Battered Forged Components',
  sentientseeds: 'Sentient Seeds',
  brandedstrongboxes: 'Branded Strongboxes'
}

/******************************************/
/************ Variables *******************/

let formTracking     = document.querySelector('form[name="trackingForm"]');
let inputToken       = formTracking.querySelector('input[name="GW2-Token"]');
let selPossibleFarms    = formTracking.querySelector('select[name="possibleFarms"]');
let trackedEndpoints = document.querySelector('#trackedEndpoints');

let timerStart = Date.now();
let timeFarmed = 0;
let timerInterval;

let actionHandler  = 0;
let characterNames = [];
let itemStartCount = {};
let itemStopCount  = {};
let itemDifference = {};
let farmedItems    = [];

/******************************************/
/********** Base Functions ****************/

// Build Select, for easier adding new farms
let setPossibleFarm = function() {
  let str2html = []

  str2html.push('<option value="" disabled selected>Select your option</option>');

  str2html.push('<optgroup label="Farms">');
  for(farm in possibleFarms) {
    str2html.push('<option value="' + farm + '">' + possibleFarms[farm] +'</option>');
  }
  str2html.push('</optgroup>');

  str2html.push('<optgroup label="Bags">');
  for(bag in possibleBags) {
    str2html.push('<option value="' + bag + '">' + possibleBags[bag] +'</option>');
  }
  str2html.push('</optgroup>');
  str2html.push('<optgroup label="Other">');
    str2html.push('<option value="other">Nothing on the list</option>');
  str2html.push('</optgroup>');


  selPossibleFarms.innerHTML = str2html.join('');
}()

// Because I'm too lazy to write it everytime
let buildEndpoint = function(ep) {
  return baseURL + ep + '?lang=en&access_token=' + inputToken.value;
}

// Building html table
let buildHTML = function(chars) {
  // Performance: First init array
  let str2html = [];

  // bank
  str2html.push('<tr id="hl-bank"><td>Bank</td><td class="start apicheck"></td><td class="stop apicheck"></td></tr>');
  // wallet
  str2html.push('<tr id="hl-wallet"><td>Wallet</td><td class="start apicheck"></td><td class="stop apicheck"></td></tr>');
  // materials
  str2html.push('<tr id="hl-materials"><td>Materials</td><td class="start apicheck"></td><td class="stop apicheck"></td></tr>');

  // For every character build a wrapper
  // lowercase character name and replace whitespace
  for (var i = chars.length - 1; i >= 0; i--) {
    str2html.push('<tr id="hl-' + chars[i].toLowerCase().replace(/\s/g, '-') + '"><td>' + chars[i] + '</td><td class="start apicheck"></i></td><td class="stop apicheck"></i></td></tr>');
  }

  // Performance: Then insert joined array
  trackedEndpoints.innerHTML = str2html.join('');
}

// Handle form sumbit
let formHandler = function(e) {
  // Do not submit Form
  e.preventDefault();

  if (actionHandler === 0) {
    startTracking();
  } else if (actionHandler === 1) {
    stopTracking();
  }
}

// Implement "human readable" time to Number
Number.prototype.toHumanTimer = function () {
  let sec_num = parseInt(this, 10); // don't forget the second param
  let hours   = Math.floor(sec_num / 3600);
  let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
  let seconds = sec_num - (hours * 3600) - (minutes * 60);
  let time = '';

  if (hours === 1) {
    time = time + hours + ' hour ';
  } else if (hours >= 1) {
    time = time + hours + ' hours ';
  }
  if (minutes === 1) {
    time = time + minutes + ' minute ';
  } else if (minutes >= 1) {
    time = time + minutes + ' minutes ';
  }
  if (seconds === 1) {
    time = time + seconds + ' second ';
  } else if (seconds >= 1) {
    time = time + seconds + ' seconds ';
  }

  // return hours+' hours '+minutes+' minutes and '+ seconds + ' seconds';
  return time;
}

let getAPIData = function (action) {
  let pms = []

  for (var i = characterNames.length - 1; i >= 0; i--) {
    pms.push(getInventory(characterNames[i]).then(function(charinv) {
        // Add done indicator
        let trc = document.querySelector('#hl-' + charinv[0].toLowerCase().replace(/\s/g, '-'));
        trc.querySelector('td.apicheck.'+action).classList.add('done')
        return charinv[1];
      }));
  }

  pms.push(getBank().then(function(bank) {
      // Add done indicator
      let trbank = document.querySelector('#hl-bank');
      trbank.querySelector('td.apicheck.'+action).classList.add('done')
      return {
        bank: bank
      };
    }));

  pms.push(getMaterials().then(function(materials) {
      // Add done indicator
      let trmaterials = document.querySelector('#hl-materials');
      trmaterials.querySelector('td.apicheck.'+action).classList.add('done')
      return {
        materials: materials
      };
    }));

  pms.push(getWallet().then(async function(wallet) {
      // Add done indicator
      let trwallet = document.querySelector('#hl-wallet');
      trwallet.querySelector('td.apicheck.'+action).classList.add('done')
      return {
        wallet: wallet
      };
    }));

  return pms;
}

// Start tracking, getting initial values
let startTracking = async function() {
  getTokenInfo()
  .then(getCharacterNames)
  .then(function(chars) {

    actionHandler = 1
    formTracking.querySelector('input[type="submit"]').value = 'Stop Farming';
    characterNames = chars;

    let promises = getAPIData('start');

    Promise.all(promises).then(function(e) {
      timerStart = Date.now();
      timerInterval = setInterval(fnTimer, 1000);
      itemStartCount = flattenItems(e);
    });
  });
}

// Stop Tracking, getting values
let stopTracking = async function() {
  // Calculate the time difference from start until now
  timeFarmed = (Date.now() - timerStart) / 1000;

  // Stop displaying time
  clearInterval(timerInterval);

  let promises = getAPIData('stop');

  Promise.all(promises).then(function(e) {
    itemStopCount = flattenItems(e);
  })
  .then(calcDifference)
  .then(displayFarmedItems);
}

/******************************************/
/*********** API Functions ****************/

// Check if all permissions needed are granted
// If no errors, start getting characters
let getTokenInfo = async function() {
  let str2html = [];
  const response = await fetch(buildEndpoint(epTokeninfo));
  let tokeninfo = await response.json();

  if (tokeninfo.text === undefined) {
    for (var i = neededPermissions.length - 1; i >= 0; i--) {
      if (!tokeninfo.permissions.includes(neededPermissions[i])) {

        str2html.push('No Permission "' + neededPermissions[i] + '"');
      }
    }
  } else {
    // throw Error(tokeninfo.text);
    str2html.push(tokeninfo.text);
  }
  if (str2html.length > 0) {
    document.querySelector('p.errors').innerHTML = str2html.join('');
    throw Error(str2html.join(''));
  }
}

// Get AccountInfo, only for account name, for contributors
let getAccountInfo = async function () {
  let ep = buildEndpoint(epAccount);

  // Request
  const response = await fetch(ep);
  let account = await response.json();

  return account;
}

// Getting all Characters from Account
let getCharacterNames = async function() {
  const response = await fetch(buildEndpoint(epCharacters));
  let charNames = await response.json();

  buildHTML(charNames);

  return charNames;
}

// Get Inventory from Character
let getInventory = async function(character) {
  // Getting endpoint for each Character
  ep = buildEndpoint(epCharacters + '/' + character + '/inventory');
  // Request
  const response = await fetch(ep);
  let inventory = await response.json();

  // return character and its inventory
  return [
  character,
  inventory
  ];
}

// Get Bank
let getBank = async function() {
  // Getting endpoint
  ep = buildEndpoint(epBank);

  // Request
  const response = await fetch(ep);
  let bank = await response.json();

  return bank;
}

// Get Materials
let getMaterials = async function() {
  // Getting endpoint
  ep = buildEndpoint(epMaterials);

  // Request
  const response = await fetch(ep);
  let mats = await response.json();

  return mats;
}

// Get Wallet
let getWallet = async function() {
  // Getting endpoint
  ep = buildEndpoint(epWallet);

  // Request
  const response = await fetch(ep);
  let wallet = await response.json();

  return wallet;
}

// Get description of all currencies
let getCurrencyDetails = async function () {
  let cEp = baseURL + '/v2/currencies?ids=all&lang=en';

  const cResponse = await fetch(cEp);
  let details = cResponse.json();

  return details;
}

// let getItemDetails = async function (ids) {
//   let iEp = baseURL + '/v2/items?lang=en&ids=' + ids.join(',');
//   const cResponse = await fetch(cEp);
//   let details = cResponse.json();
//   return details;
// }

/******************************************/
/******** Calculate Functions *************/

// Flatten the JSON objects from API
//
let flattenItems = function(rawData) {
  let itemCount = {};
  // let walletCount
  for (var k = rawData.length - 1; k >= 0; k--) {
    if (typeof rawData[k].bags !== 'undefined') {
      for (var i = rawData[k].bags.length - 1; i >= 0; i--) {
        if (rawData[k].bags[i] === null)
          continue;
        for (var j in rawData[k].bags[i].inventory) {
          if (rawData[k].bags[i].inventory[j] === null)
            continue;
          // console.debug(rawData[k].bags[i])
          if (itemCount['i' + rawData[k].bags[i].inventory[j].id] === undefined) {
            itemCount['i' + rawData[k].bags[i].inventory[j].id] = rawData[k].bags[i].inventory[j].count;
          } else {
            itemCount['i' + rawData[k].bags[i].inventory[j].id] += rawData[k].bags[i].inventory[j].count;
          }
        }
      };
    } else if (typeof rawData[k].bank !== 'undefined') {
      for (var i in rawData[k].bank) {
        if (rawData[k].bank[i] === null)
          continue;
        if (itemCount['i' + rawData[k].bank[i].id] === undefined) {
          itemCount['i' + rawData[k].bank[i].id] = rawData[k].bank[i].count;
        } else {
          itemCount['i' + rawData[k].bank[i].id] += rawData[k].bank[i].count;
        }
      }
    } else if (typeof rawData[k].materials !== 'undefined') {
      for (var i in rawData[k].materials) {
        if (rawData[k].materials[i] === null)
          continue;
        if (itemCount['i' + rawData[k].materials[i].id] === undefined) {
          itemCount['i' + rawData[k].materials[i].id] = rawData[k].materials[i].count;
        } else {
          itemCount['i' + rawData[k].materials[i].id] += rawData[k].materials[i].count;
        }
      }
    } else if (typeof rawData[k].wallet !== 'undefined') {
      for (var i in rawData[k].wallet) {
        if (rawData[k].wallet[i] === null)
          continue;
        if (itemCount['w' + rawData[k].wallet[i].id] === undefined)
          itemCount['w' + rawData[k].wallet[i].id] = rawData[k].wallet[i].value;
      }
    }
  }

  return itemCount;
}

//
let calcDifference = function() {
  let count = 0;
  for (var item in itemStartCount) {
    if (typeof itemStopCount[item] === 'undefined') {

      itemStopCount[item] = 0;
    }
  }

  for (var item in itemStopCount) {
    if (typeof itemStartCount[item] !== 'undefined') {
      count = itemStopCount[item] - itemStartCount[item];
    } else {
      count = itemStopCount[item];
    }
    if (count !== 0) {
      itemDifference[item] = count;
    }
  }
}



/******************************************/
/********** Display Functions *************/

// Function for Timer
let fnTimer = function () {
  var delta = Date.now() - timerStart; // milliseconds elapsed since start
  document.querySelector('span.timer').innerHTML = 'Farming for ' + Math.floor(delta / 1000).toHumanTimer();
}

let displayCurrencies = async function () {
  let cDetails = await getCurrencyDetails();
  let str2html = [];

  for (var i = cDetails.length - 1; i >= 0; i--) {6
    if(typeof itemDifference['w'+cDetails[i].id] !== 'undefined') {
      farmedItems.push([
        cDetails[i].name,
        cDetails[i].id,
        itemDifference['w' + cDetails[i].id]
        ]);
      if (cDetails[i].id === 1) {
        let neg = 1;
        if (itemDifference['w'+cDetails[i].id] < 0)
           neg = -1;
        let overallCopperABS = itemDifference['w'+cDetails[i].id];

        let gold = Math.floor(overallCopperABS/10000) * neg;
        let leftCopper = overallCopperABS % 10000;
        let silver = Math.floor(leftCopper/100) * neg;
        let copper = leftCopper % 100 * neg ;

        str2html.push('<li>');
        if(gold !== 0)
          str2html.push(gold + '<span class="sprite"><img src="img/gold.png" alt="g"></span>');
        if(silver !== 0)
          str2html.push(silver + '<span class="sprite"><img src="img/silver.png" alt="s"></span>');
        if(copper !== 0)
          str2html.push(copper + '<span class="sprite"><img src="img/copper.png" alt="c"></span>');
        str2html.push('</li>');
      } else {
        str2html.push('<li>'+itemDifference['w'+cDetails[i].id]+'<span class="sprite"><img src="' + cDetails[i].icon + '" alt="' + cDetails[i].name + '"></span></li>')
      }
    }
  }

  document.querySelector('#farmedCurrencies').innerHTML = str2html.join('');
}

let displayItems = async function() {
  let ids = Object.keys(itemDifference).map(function(item) {
    if (item[0] !== 'i')
      return;
    return item.substring(1);
  });

  ids = ids.filter(function(el) {
    return el != null
  });

  // TODO: Fix limit for API
  let iEp = baseURL + '/v2/items?lang=en&ids=' + ids.join(',');

  // Request
  const iResponse = await fetch(iEp);
  let iDetails = await iResponse.json();

  let str2html = [];

  if (iDetails.length > 0) {
    for (var i = 0; i < iDetails.length; i++) {
      farmedItems.push([
        iDetails[i].name,
        iDetails[i].id,
        itemDifference['i' + iDetails[i].id]
        ]);
      str2html.push('<div class="item" id="i' + iDetails[i].id + '"><img src="' + iDetails[i].icon + '" alt="' + iDetails[i].name + '"><span class="count">' + itemDifference['i' + iDetails[i].id] + '</span></div>');
    }
    document.querySelector('#farmedItems').innerHTML = str2html.join('');
  }
}

let displayFarmedItems = function() {
  Promise.all([displayItems(),displayCurrencies(),getAccountInfo()])
  .then(generateCSV)
}

let generateCSV = function (args) {
  let firstLine = [selPossibleFarms.value, args[2].name, timeFarmed].join(',')+'\n';

  let timestampForFileName = new Date().toISOString();

  let csvHeaders = ['Item Name','ID', 'Count'].join(',')+'\n';
  let itemArray2CSV = farmedItems.map(e => e.join(',')).join('\n');

  // Concat everything
  let csvContent = 'data:text/csv;charset=utf-8,' + firstLine + csvHeaders + itemArray2CSV;

  let encodedUri = encodeURI(csvContent);
  let link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', selPossibleFarms.value+'_'+args[2].name +'_'+ timestampForFileName +'.csv');
  document.body.appendChild(link); // Required for FF

  link.click(); // This will download the data file named 'my_data.csv'.
}

/******************************************/
/*************** Event ********************/
formTracking.addEventListener('submit', formHandler);


