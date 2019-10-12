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

/******************************************/
/************ Variables *******************/

let formTracking     = document.querySelector('form[name="trackingForm"]');
let inputToken       = formTracking.querySelector('input[name="GW2-Token"]');
let possibleFarms    = formTracking.querySelector('select[name="possibleFarms"]');
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
    startTracking();
  } else if (e.target.querySelector('input[name="actionHandler"]').value === '1') {
    stopTracking();
  }
}


let startTracking = async function() {
  getTokenInfo()
    .then(getCharacterNames)
    .then(function(chars) {

      formTracking.querySelector('input[name="actionHandler"]').value = 1;
      formTracking.querySelector('input[type="submit"]').value = 'Stop Farming';
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
        timerStart = Date.now();
        timerInterval = setInterval(timer, 1000);
        itemStartCount = flattenItems(e);
      });
    });
}

let stopTracking = async function() {
  let promises = [];

  clearInterval(timerInterval);

  timeFarmed = Date.now() - timerStart;

  // trackingForm.querySelector('input[type="submit"]').disabled;
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

let currencyDetails = async function () {
  let cEp = baseURL + '/v2/currencies?ids=all&lang=en';

  const cResponse = await fetch(cEp);
  let details = cResponse.json();

  return details;
}

// let itemDetails = async function (ids) {
//   let iEp = baseURL + '/v2/items?lang=en&ids=' + ids.join(',');
//   const cResponse = await fetch(cEp);
//   let details = cResponse.json();
//   return details;
// }
//


// TODO: Styling of gold, currently displayed as copper with gold sprite
let displayCurrencies = async function () {
  let cDetails = await currencyDetails();
  let str2html = [];

  for (var i = cDetails.length - 1; i >= 0; i--) {6
    if(typeof itemDifference['w'+cDetails[i].id] !== 'undefined') {
      farmedItems.push([
        cDetails[i].name,
        cDetails[i].id,
        itemDifference['w' + cDetails[i].id]
      ]);
      str2html.push('<li>'+itemDifference['w'+cDetails[i].id]+'<span class="sprite"><img src="' + cDetails[i].icon + '" alt="' + cDetails[i].name + '"></span></li>')
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

let getAccountInfo = async function () {
    // TODO: Fix limit for API
    let ep = buildEndpoint(epAccount);

    // Request
    const response = await fetch(ep);
    let account = await response.json();

    return account;
}

let displayFarmedItems = function() {
  Promise.all([displayItems(),displayCurrencies(),getAccountInfo()])
      .then(generateCSV)
}

let generateCSV = function (args) {
  let head = [possibleFarms.value, args[2].name, timeFarmed].join(',')+'\n'
  let headers = ['item','id', 'count'].join(',')+'\n';
  let arr2csv = farmedItems.map(e => e.join(",")).join("\n");
  let csvContent = 'data:text/csv;charset=utf-8,'+head+headers+arr2csv;
  let encodedUri = encodeURI(csvContent);
  let link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', possibleFarms.value+'_'+args[2].name +'_'+ Date.now().toISOString()+'.csv');
  document.body.appendChild(link); // Required for FF

  link.click(); // This will download the data file named 'my_data.csv'.
}

let timer = function () {
  var delta = Date.now() - timerStart; // milliseconds elapsed since start
  document.querySelector('span.timer').innerHTML = 'Farming for ' + Math.floor(delta / 1000).toHumanTimer();
}

Number.prototype.toHumanTimer = function () {
    let sec_num = parseInt(this, 10); // don't forget the second param
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);
    let time = '';
    // if (hours   < 10) {hours   = "0"+hours;}
    // if (minutes < 10) {minutes = "0"+minutes;}
    // if (seconds < 10) {seconds = "0"+seconds;}
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

/******************************************/
/*************** Event ********************/
formTracking.addEventListener('submit', formHandler);


