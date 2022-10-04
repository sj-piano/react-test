import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

import './App.css';

let _ = require('lodash');


let log = console.log;
let jd = JSON.stringify;
let lj = (x) => { log(jd(x)) }


let contractAddressGoerli = '0xd26baf8a3047cd61d8b4e789e3c21138d2c94a49';
// Relevant: https://docs.ethers.io/v5/api/contract/example/#example-erc-20-contract--connecting-to-a-contract
let abi = [

  // Read contract
  "function assets(uint assetId) view returns (address creator, string assetName, uint totalShares, uint sharePrice)",
  "function getAssetOwnerShares(uint assetId, address owner) view returns (uint shares)",
  "function getAssetOwners(uint assetId) view returns (address[] owners)",
  "function getTotalAssets() view returns (uint value)",
  "function getTotalUsers() view returns (uint value)",

  // Write to contract
  "function purchaseShares(uint assetId, uint requestedShares) payable returns (bool)",
  "function createAsset(string assetName, uint totalShares, uint sharePrice) payable",

];



let App = () => {


  // State: Metamask connectivity
  let [haveMetamask, setHaveMetamask] = useState(false);
  let [metamaskConnected, setMetamaskConnected] = useState(false);

  // State: User's account
  let [userAddress, setUserAddress] = useState('');
  let [userBalance, setUserBalance] = useState(0);

  // State: Smart contract data
  let [totalAssets, setTotalAssets] = useState(0);
  let [totalUsers, setTotalUsers] = useState(0);
  let [assetData, setAssetData] = useState([]);

  // State: Form data
  let [buyData, setBuyData] = useState({'assetId': -1, 'numberOfShares': 0});
  let [createData, setCreateData] = useState({'assetName': '', 'totalShares': 0, 'sharePrice': 0});

  // Load Metamask if available.
  let { ethereum } = window;
  let provider = new ethers.providers.Web3Provider(window.ethereum);



  useEffect( () => {
    initialSetup();
  }, []);


  let initialSetup = async () => {
    log('\n\n === START ===');
    let metamaskPresent = !!ethereum;
    //log({metamaskPresent});
    setHaveMetamask(metamaskPresent);
    await connectMetamask();
    let network = await provider.getNetwork();
    //log({network});
    await loadContractData();
  }


  let connectMetamask = async () => {
    log(`Start: connectMetamask`);
    await ethereum.enable();
    let accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    });
    //log(`${accounts.length} accounts found in Metamask.`);
    let address = accounts[0];
    setUserAddress(accounts[0])
    let balance = await provider.getBalance(address);
    let balance_wei = balance.toString();
    let balance_eth = ethers.utils.formatEther(balance);
    //log({balance_wei});
    //log({balance_eth});
    setUserBalance(balance_wei);
    setMetamaskConnected(true);
    log(`End: connectMetamask`);

  }


  let loadContractData = async () => {
    log(`Start: loadContractData`);
    let data = [];
    let contract = new ethers.Contract(contractAddressGoerli, abi, provider);
    let totalAssetsX = (await contract.getTotalAssets()).toString();
    //log({totalAssetsX});
    let totalUsersX = (await contract.getTotalUsers()).toString();
    //log({totalUsersX});
    for (let i=0; i < totalAssetsX; i++) {
      let assetId = i;
      let x = {};
      let assetInfo = await contract.assets(assetId);
      //log({assetInfo});
      let {creator, assetName, totalShares, sharePrice} = assetInfo;
      totalShares = totalShares.toString();
      sharePrice = sharePrice.toString();
      _.assign(x, {creator, assetName, totalShares, sharePrice});
      let owners = await contract.getAssetOwners(assetId);
      //log({owners});
      let totalOwners = owners.length;
      let shareOwnership = {};
      for (let owner of owners) {
        //log({owner});
        let ownerShares = await contract.getAssetOwnerShares(assetId, owner);
        ownerShares = ownerShares.toString();
        shareOwnership[owner] = ownerShares;
      }
      _.assign(x, {totalOwners, owners, shareOwnership});
      data.push(x);
    }
    setAssetData(data);
    setTotalAssets(totalAssetsX);
    setTotalUsers(totalUsersX);
    log(`End: loadContractData`);
  }


  if (! haveMetamask) return (
    <div className="app">
      <div className="display">
        <p>Please install Metamask to use this app.</p>
      </div>
    </div>
  )


  if (! metamaskConnected) return (
    <div className="app">
      <div className="display">
        Your Metamask wallet should automatically try to connect. Try reloading the page if it doesn't.
      </div>
    </div>
  )


  // Render assetData into a panel per asset.
  let template = ({
    addDivider,
    assetId, assetName, creator, totalShares, sharePrice,
    totalOwners, owners, shareOwnership,
  }) => {
    let ownerSection = owners.reduce(
      (s, owner) => {
        //log(`${shareOwnership[owner]}`);
        s += `-- ${shareOwnership[owner]} shares: ${owner} <br/>`;
        return s
      },
      ''
    );
    //log({ownerSection});
    let result = `
  <div className='panel'>
    <br/>
    Asset ${assetId}: "${assetName}" - Created by ${creator}, ${totalShares} shares, ${sharePrice} wei / share. </br>
    - ${totalOwners} share owners: <br/>
    ${ownerSection}
    <br/>
  </div>
`;
    if (addDivider) {
      result += `<hr>\n`;
    }
    return result;
  }


  let allPanels = '';
  for (let i=0; i < totalAssets; i++) {
    let assetId = i;
    let a = assetData[i];
    let {
      assetName, creator, totalShares, sharePrice,
      totalOwners, owners, shareOwnership,
    } = a;
    let addDivider = true;
    if (i === totalAssets - 1) addDivider = false;
    let panel = template({
      addDivider,
      assetId, assetName, creator, totalShares, sharePrice,
      totalOwners, owners, shareOwnership,
    });
    allPanels += '\n' + panel + '\n';
  }




  // === Purchase Shares

  let handleChangeAssetId = (event) => {
    let assetId = event.target.value;
    buyData['assetId'] = assetId;
    setBuyData(buyData);
  }

  let handleChangeNumberOfShares = (event) => {
    let numberOfShares = event.target.value;
    buyData['numberOfShares'] = numberOfShares;
    setBuyData(buyData);
  }

  let handleSubmitPurchaseShares = async (event) => {
    log('Start: handleSubmitPurchaseShares');
    event.preventDefault();
    let {assetId, numberOfShares} = buyData;
    let signer = provider.getSigner();
    let contract = new ethers.Contract(contractAddressGoerli, abi, signer);
    //let totalAssetsX = (await contract.totalAssets()).toString();
    //log({totalAssetsX});
    if (assetId < 0) {
      log(`assetId (${assetId}) is less than 0. Stopping BuyRequest here.`);
      return;
    }
    if (numberOfShares < 1) {
      log(`numberOfShares (${numberOfShares}) is less than 1. Stopping BuyRequest here.`);
      return;
    }
    let feeData = await provider.getFeeData();
    //log({feeData});
    let selectedGasPrice = feeData.gasPrice.toString();
    //log({selectedGasPrice});
    //let userAddress2 = await signer.getAddress();
    //let contractWithSigner = contract.connect(signer);
    let sharePrice = assetData[assetId].sharePrice;
    log({sharePrice});
    let costWei = (numberOfShares * sharePrice).toString();
    log({costWei});
    let tx = await contract.purchaseShares(assetId, numberOfShares,
      {
        value: ethers.utils.parseUnits(costWei, "wei"),
        gasLimit: 1000000,
        //gasPrice: selectedGasPrice,
      }
    )
    //log({tx});
    let receipt = await tx.wait();
    //log({receipt});
    let msg = `Sent request to buy ${numberOfShares} shares of asset ${assetId} for user address ${userAddress}.`;
    log(msg);
    log('End: handleSubmitPurchaseShares');
  }


  // === Create New Asset

  let handleChangeAssetName = async (event) => {
    let assetName = event.target.value;
    createData['assetName'] = assetName;
    setCreateData(createData);
  }

  let handleChangeTotalShares = async (event) => {
    let totalShares = event.target.value;
    createData['totalShares'] = totalShares;
    setCreateData(createData);
  }

  let handleChangeSharePrice = async (event) => {
    let sharePrice = event.target.value;
    createData['sharePrice'] = sharePrice;
    setCreateData(createData);
  }

  let handleSubmitCreateAsset = async (event) => {
    log('Start: handleSubmitCreateAsset');
    event.preventDefault();
    let {assetName, totalShares, sharePrice} = createData;
    let signer = provider.getSigner();
    let contract = new ethers.Contract(contractAddressGoerli, abi, signer);
    if (assetName.length === 0) {
      log(`assetName is empty. Stopping CreateRequest here.`);
      return;
    }
    if (totalShares < 1) {
      log(`totalShares (${totalShares}) is less than 1. Stopping CreateRequest here.`);
      return;
    }
    if (sharePrice < 1) {
      log(`sharePrice (${sharePrice}) is less than 1. Stopping CreateRequest here.`);
      return;
    }
    let tx = await contract.createAsset(assetName, totalShares, sharePrice,
      {
        //value: ethers.utils.parseUnits("0", "wei"),
        gasLimit: 1000000,
      }
    )
    log({tx});
    let receipt = await tx.wait();
    log({receipt});
    log('End: handleSubmitCreateAsset');
  }




  return (
    <div className="app">
      <div className="display">
        <div className="topPanel">
          <h2 className="title">Asset Register</h2>
          <b>Total assets: {totalAssets}</b> <br/>
          <b>Total users: {totalUsers}</b> <br/>
          <br/>

          <b><i>Purchase shares</i></b>
          <form onSubmit={handleSubmitPurchaseShares}>
            <label className="form-label">
              Asset ID:
              <input type="text" id="assetId" defaultValue=""
                className="form-input"
                size="10"
                onChange={handleChangeAssetId}
              />
            </label>
            <label className="form-label">
              Number of shares:
              <input type="text" id="numberOfShares" defaultValue=""
                className="form-input"
                size="10"
                onChange={handleChangeNumberOfShares}
              />
            </label>
            <input type="submit" value="Buy" className="form-button" />
          </form>
          <br/>

          <b><i>Create new asset</i></b>
          <form onSubmit={handleSubmitCreateAsset}>
            <label className="form-label">
              Asset name:
              <input type="text" id="assetName" defaultValue=""
                className="form-input"
                size="20"
                onChange={handleChangeAssetName}
              />
            </label>
            <label className="form-label">
              Total shares:
              <input type="text" id="totalShares" defaultValue=""
                className="form-input"
                size="10"
                onChange={handleChangeTotalShares}
              />
            </label>
            <label className="form-label">
              Price per share (wei):
              <input type="text" id="sharePrice" defaultValue=""
                className="form-input"
                size="10"
                onChange={handleChangeSharePrice}
              />
            </label>
            <input type="submit" value="Create" className="form-button" />
          </form>
          <br/>

        </div>
        <br/>
        <div className="assetPanels" dangerouslySetInnerHTML={{__html: allPanels}}>
        </div>
      </div>
    </div>
  );
}


export default App;

