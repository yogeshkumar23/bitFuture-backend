//var Web3 = require('web3')
//const web3 = new Web3('https://bsc-dataseed.binance.org/')
const qs = require('qs')
const axios = require('axios').default;
const crypto = require('crypto');
//const { resolve } = require('path');

/*var db_Sec = require('knex')({
    client: 'mysql',
    connection:{
        host:process.env.DB_SEC_HOST,
        user:process.env.DB_SEC_USER,
        password:process.env.DB_SEC_PASS,
        database:process.env.DB_SEC_NAME
    },
    pool: {
        min: Number(process.env.DB_POOL_MIN),
        max: Number(process.env.DB_POOL_MAX)
      },
      acquireConnectionTimeout: Number(process.env.DB_TIMEOUT)
})

const createWallet = async () => {
    let newWallet = await web3.eth.accounts.wallet.create(1)
    let keyStroke = await web3.eth.accounts.wallet.encrypt(process.env.BLOCKCHAIN_CRYPTO_PASS)
    return keyStroke;
}

const getEncryptAccount = async () => {
    let keyStrokeValue = await createWallet()
    let walletAccount = await web3.eth.accounts.wallet.decrypt(
      keyStrokeValue,
      process.env.BLOCKCHAIN_CRYPTO_PASS
    );
    let lastAccountIndex = walletAccount.length-1
    return {publicAddress:walletAccount[lastAccountIndex].address,privateKey:walletAccount[lastAccountIndex].privateKey,encryptedWalletAccount:JSON.stringify(keyStrokeValue[lastAccountIndex])}
};

module.exports.createCryptoWalletForUser =async (uid)=>{
    let accountResult =await getEncryptAccount()
    accountResult.uid = uid
    let result = await db_Sec('user_crypto_wallet').insert(accountResult)
    return result
}

module.exports.getCrytoWalletForUser =async (uid)=>{
    let result = await db_Sec('user_crypto_wallet').where({uid:uid})
    return result
}*/

module.exports.binanceGetBalance=()=>{
   return new Promise((resolve)=>{
    binance.balance((error, balances) => {
        if ( error ) resolve(error);
        else resolve(balances);
    });
  })
}

module.exports.cryptoWithdraw=async (req_data)=>{
   
   var response = {}
   const dataQueryString = qs.stringify(req_data)
   const signature = crypto.createHmac('sha256',process.env.BINANCE_SECRET_KEY).update(dataQueryString).digest('hex')
   try{
    const result = await axios.post(process.env.BINANCE_BASE_URL+process.env.BINANCE_API_URL+"?"+dataQueryString+"&signature="+signature,req_data,{
            headers: {
                "X-MBX-APIKEY" : process.env.BINANCE_APIKEY,
            }
        });
        response.error = false
        response.data = result.data
    }catch (error) {
        let orgError;
        if(error.data){
            orgError = error
        }else if(error.response && error.response.data){
           orgError = error.response.data
        }else{
           orgError = error
        }
        console.log("ER",orgError)
        response.error = true
        response.data = error
    }
    return response
}

module.exports.getCryptoWithdrawDetailsById = async(req_data)=>{
   var response = {}
   const dataQueryString = qs.stringify(req_data)
   const signature = crypto.createHmac('sha256',process.env.BINANCE_SECRET_KEY).update(dataQueryString).digest('hex')

   try{
    const result = await axios.get(process.env.BINANCE_BASE_URL+"sapi/v1/capital/withdraw/history"+"?"+dataQueryString+"&signature="+signature,{
            headers: {
                "X-MBX-APIKEY" : process.env.BINANCE_API_KEY,
            }
        });
        response.error = false
        response.data = result.data
    }catch (error) {
        response.error = true
        response.data = error.response.data
    }
    return response
}