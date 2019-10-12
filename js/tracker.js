/******************************************/
/************ Constants *******************/

const baseURL = 'https://api.guildwars2.com';
const epTokeninfo = '/v2/tokeninfo';
const epCharacters = '/v2/characters';
const epWallet = '/v2/account/wallet';
const epBank = '/v2/account/bank';
const epMaterials = '/v2/account/materials';

const neededPermissions = [
  "wallet",
  "characters",
  "account",
  "inventories"
];

/******************************************/
/************ Variables *******************/

let formTracking = document.querySelector('form[name="trackingForm"]');
let inputToken = formTracking.querySelector('input[name="GW2-Token"]');
let trackedEndpoints = document.querySelector('#trackedEndpoints');

let actionHandler = 0;

let characterNames = [];

let itemStartCount = {};
let itemStopCount = {};

let itemDifference = {};

/******************************************/
/************ Functions *******************/

// Because I'm too lazy to write it everytime
let buildEndpoint = function(ep) {
  return baseURL + ep + '?access_token=' + inputToken.value;
}

// Building html table
let buildHTML = function(chars) {
  // Performance: First init array
  let str2html = [];

  // For every character build a wrapper
  // lowercase character name and replace whitespace
  for (var i = chars.length - 1; i >= 0; i--) {
    str2html.push('<tr id="hl-' + chars[i].toLowerCase().replace(/\s/g, '-') + '"><td>' + chars[i] + '</td><td><i class="fas fa-spinner"></i></td><td><i class="fas fa-spinner"></i></td></tr>');
  }

  // bank
  str2html.push('<tr id="hl-bank"><td>Bank</td><td><i class="fas fa-spinner"></i></td><td><i class="fas fa-spinner"></i></td></tr>');
  // wallet
  str2html.push('<tr id="hl-wallet"><td>Wallet</td><td><i class="fas fa-spinner"></i></td><td><i class="fas fa-spinner"></i></td></tr>');
  // materials
  str2html.push('<tr id="hl-materials"><td>Materials</td><td><i class="fas fa-spinner"></i></td><td><i class="fas fa-spinner"></i></td></tr>');

  // Performance: Then insert joined array
  trackedEndpoints.innerHTML = str2html.join('');
}

let formHandler = function(e) {
  // Do not submit Form
  e.preventDefault();

  if (e.target.querySelector('input[name="actionHandler"]').value === '0') {
    e.target.querySelector('input[name="actionHandler"]').value = 1;
    e.target.querySelector('input[type="submit"]').value = 'Stop Farming';
    startTracking();
  } else if (e.target.querySelector('input[name="actionHandler"]').value === '1') {
    // e.target.querySelector('input[name="actionHandler"]').value = 1;
    e.target.querySelector('input[type="submit"]').disabled;
    stopTracking();
  }
}


let startTracking = async function() {
  getTokenInfo()
    .then(getCharacterNames)
    .then(function(chars) {
      characterNames = chars;

      let promises = [];

      for (var i = chars.length - 1; i >= 0; i--) {
        promises.push(getInventory(chars[i]).then(function(charinv) {
          // invStartingValues.push(calcBagCount(charinv[1]));
          // Remove spinner, add checked mark
          let trc = document.querySelector('#hl-' + charinv[0].toLowerCase().replace(/\s/g, '-'));
          trc.querySelectorAll('td')[1].innerHTML = '<i class="fas fa-check"></i>';
          return charinv[1];
        }));
      }

      promises.push(getBank().then(function(bank) {
        // bankStartingValues = calcBankCount(bank);
        // Remove spinner, add checked mark
        let trbank = document.querySelector('#hl-bank');
        trbank.querySelectorAll('td')[1].innerHTML = '<i class="fas fa-check"></i>';
        return {
          bank: bank
        };
      }));

      promises.push(getMaterials().then(function(materials) {
        // materialsStartingValues = calcMaterialsCount(materials);
        // Remove spinner, add checked mark
        let trmaterials = document.querySelector('#hl-materials');
        trmaterials.querySelectorAll('td')[1].innerHTML = '<i class="fas fa-check"></i>';
        return {
          materials: materials
        };
      }));

      promises.push(getWallet().then(async function(wallet) {
        // walletStartingValues = await calcWalletCount(wallet);
        // Remove spinner, add checked mark
        let trwallet = document.querySelector('#hl-wallet');
        trwallet.querySelectorAll('td')[1].innerHTML = '<i class="fas fa-check"></i>';
        return {
          wallet: wallet
        };
      }));

      Promise.all(promises).then(function(e) {
        itemStartCount = flattenItems(e);
      });
    });
}

let stopTracking = async function() {
  let promises = [];

  for (var i = characterNames.length - 1; i >= 0; i--) {
    promises.push(getInventory(characterNames[i]).then(function(charinv) {
      // invStartingValues.push(calcBagCount(charinv[1]));
      // Remove spinner, add checked mark
      let trc = document.querySelector('#hl-' + charinv[0].toLowerCase().replace(/\s/g, '-'));
      trc.querySelectorAll('td')[2].innerHTML = '<i class="fas fa-check"></i>';
      return charinv[1];
    }));
  }

  promises.push(getBank().then(function(bank) {
    // bankStartingValues = calcBankCount(bank);
    // Remove spinner, add checked mark
    let trbank = document.querySelector('#hl-bank');
    trbank.querySelectorAll('td')[2].innerHTML = '<i class="fas fa-check"></i>';
    return {
      bank: bank
    };
  }));

  promises.push(getMaterials().then(function(materials) {
    // materialsStartingValues = calcMaterialsCount(materials);
    // Remove spinner, add checked mark
    let trmaterials = document.querySelector('#hl-materials');
    trmaterials.querySelectorAll('td')[2].innerHTML = '<i class="fas fa-check"></i>';
    return {
      materials: materials
    };
  }));

  promises.push(getWallet().then(async function(wallet) {
    // walletStartingValues = await calcWalletCount(wallet);
    // Remove spinner, add checked mark
    let trwallet = document.querySelector('#hl-wallet');
    trwallet.querySelectorAll('td')[2].innerHTML = '<i class="fas fa-check"></i>';
    return {
      wallet: wallet
    };
  }));

  Promise.all(promises).then(function(e) {
      itemStopCount = flattenItems(e);
    })
    .then(calcDifference)
    .then(displayFarmedItems);
}

// Check if all permissions needed are granted
// If no errors, start getting characters
let getTokenInfo = async function() {
  const response = await fetch(buildEndpoint(epTokeninfo));
  let tokeninfo = await response.json();

  if (tokeninfo.text === undefined) {
    for (var i = neededPermissions.length - 1; i >= 0; i--) {
      if (!tokeninfo.permissions.includes(neededPermissions[i])) {
        throw Error('No Permission "' + neededPermissions[i] + '"');
      }
    }
  } else {
    throw Error(tokeninfo.text);
  }
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

let calcDifference = function() {
  let count = 0;
  for (var item in itemStopCount) {
    if (typeof itemStartCount[item] !== 'undefined') {
      count = itemStopCount[item] - itemStartCount[item];
    } else {
      count = itemStopCount[item];
    }
    if (count > 0) {
      itemDifference[item] = count;
    }
  }
}

let displayFarmedItems = async function() {

  let ids = Object.keys(itemDifference).map(function(item) {
    if (item[0] !== 'i')
      return undefined;
    return item.substring(1);
  });

  ids = ids.filter(function(el) {
    return el != null
  });

  // TODO: Fix limit for API
  // if (ids > 50)
  let ep = baseURL + '/v2/items?ids=' + ids.slice(0, 40).join(',');


  // Request
  const response = await fetch(ep);
  let details = await response.json();

  let str2html = [];

  if (details.length > 0) {
    for (var i = 0; i < details.length; i++) {
      // items.push({
      //   name: details[i].name,
      //   item: details[i].id,
      //   count: itemDifference['id-' + details[i].id],
      //   icon: details[i].icon
      // });
      str2html.push('<div class="item" id="i' + details[i].id + '"><img src="' + details[i].icon + '" alt="' + details[i].name + '"><span class="count">' + itemDifference['i' + details[i].id] + '</span></div>');
    }

    document.querySelector('#farmed').innerHTML = str2html.join('');
  }
}

/******************************************/
/*************** Event ********************/
formTracking.addEventListener('submit', formHandler);
