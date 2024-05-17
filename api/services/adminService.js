const { param } = require("express/lib/request");
const { contentType } = require("express/lib/response");

module.exports = function (server) {
  require("../dao/adminDao")(server.db);
  require("../utility/common")();
  const fbAdmin = global.firebase;
  const fsDB = fbAdmin.firestore();
  var coinBase = server.coinBase;
  const binance = server.binance;
  const API = server.kucapi;


  this.adminRegisterService = async (params, callback) => {
    var userCred = params;
    var response = {};
    let adminDaoResults = await this.checkAdminEmailDao(userCred.email);
    if (adminDaoResults.error == false) {
      params.uid = this.makeUniqueID(20);
      /** GENERATING HASH PASSWORD */
      this.generatehash(params.password, function (passwordResponse) {
        params.hash = passwordResponse;
        this.generatePassword(params, async function (result) {
          params.password = result.hashPassword;
          adminDaoResults = await this.addAdminDao(params);
          if (adminDaoResults.error) {
            response.error = true;
            response.message = "Admin Not Added. Try Again !";
            response.errorCode = "1";
            callback(response);
          } else {
            response.error = false;
            response.message = "Admin Added Successfully";
            response.errorCode = "0";
            callback(response);
          }
        });
      });
    } else {
      response.error = true;
      response.message = "Email already registered";
      response.errorCode = "1";
      callback(response);
    }
  };

  this.adminLoginService = async (params, callback) => {
    var userCred = params.body;
    var response = {};
    let userDaoResults = await this.checkAdminEmailDao(userCred.email);
    if (userDaoResults.error) {
      userDaoResults = userDaoResults.result;
      var sessionParams = {
        uid: userDaoResults.uid,
        ipAddress: "",
        device: "",
        OS: "",
        status: "",
        description: "",
      };
      sessionParams.ipAddress = params.connection.remoteAddress
        ? params.connection.remoteAddress
        : params.socket.remoteAddress;
      if (
        params.headers["user-agent"].match(/(?<=\().*?(?=;)/) &&
        params.headers["user-agent"].match(/(?<=\().*?(?=;)/)[0]
      ) {
        sessionParams.OS =
          params.headers["user-agent"].match(/(?<=\().*?(?=;)/)[0];
      }
      if (
        params.headers["user-agent"].match(
          /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
        ) &&
        params.headers["user-agent"].match(
          /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
        )[1]
      ) {
        sessionParams.device = params.headers["user-agent"].match(
          /(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i
        )[1];
      }
      try {
        let checkPassword = await this.comparePassword(
          userDaoResults,
          userCred.password
        );
        if (checkPassword) {
          response.error = false;
          response.errorCode = "0";
          let userData = {
            firstName: userDaoResults.firstName,
            lastName: userDaoResults.lastName,
            phoneNumber: userDaoResults.phoneNumber,
            email: userDaoResults.email,
            uid: userDaoResults.uid,
            enableTwoFactor: userDaoResults.enableTwoFactor,
            admin: true,
          };
          response.user = userData;
          response.accessToken = await this.generateToken(
            userData,
            process.env.JWT_SECRET,
            "30d"
          );
          response.error = false;
          response.message = "Login Successfull";
          sessionParams.status = "Complete";
          sessionParams.description = "Logged In successfully";
          this.addSessionHistoryDao(sessionParams);
          callback(response);
        } else {
          response.error = true;
          response.message = "Email and Password does not match";
          response.errorCode = "1";
          sessionParams.status = "failed";
          sessionParams.description = "Incorrect Password";
          this.addSessionHistoryDao(sessionParams);
          callback(response);
        }
      } catch (e) {
        response.error = true;
        response.message = "Something went wrong. Try again!" + e;
        response.errorCode = "1";
        callback(response);
      }
    } else {
      response.error = true;
      response.message = "Email not registered";
      response.errorCode = "1";
      callback(response);
    }
  };

  this.listUsersService = async (params, callback) => {
    /*const userCollection = fsDB.collection('users')
        const userData = await userCollection.get()*/
    var adminDaoResults = await this.getUserListDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      adminDaoResults = adminDaoResults.result;
      for (let aul = 0; aul < adminDaoResults.length; aul++) {
        let userWallet = await this.getUserWalletAdminDao(adminDaoResults[aul].uid);
        if (userWallet.error == false) {
          adminDaoResults[aul].wallet = userWallet.result;
        }
      }
      response.userList = adminDaoResults;
    }
    callback(response);
  };

  this.listAdminService = async (params, callback) => {
    /*const userCollection = fsDB.collection('users')
      const userData = await userCollection.get()*/
    var adminDaoResults = await this.getAdminListDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.adminList = adminDaoResults.result;
    }
    callback(response);
  };

  this.updateUserActionService = async (params, callback) => {
    var response = {};
    let enable = 0;
    let updateQ;
    if (params.action == "1" || params.action == 1) {
      enable = 1;
    }
    if (params.type.toLowerCase() == "suspend") {
      if (params.date) {
        updateQ = {
          update: { is_Suspended: enable, suspend_Till: params.date },
          uid: params.uid,
        };
      } else {
        updateQ = {
          update: { is_Suspended: enable, suspend_Till: null },
          uid: params.uid,
        };
      }
    } else if (params.type.toLowerCase() == "ban") {
      updateQ = { update: { is_Baned: enable }, uid: params.uid };
    }
    let adminDaoResults = await this.updateUserActionDao(updateQ);
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "User status updated!";
      response.errorCode = "0";
    }
    callback(response);
  };

  this.updateTwoFactorAuthenticationService = async (params, callback) => {
    var response = {};
    let enable = 0;
    if (params.action == "1" || params.action == 1) {
      enable = 1;
    }
    let adminDaoResults = await this.updateTwoFactorAuthenticationDao({
      uid: params.uid,
      enable: enable,
    });
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "User status updated!";
      response.errorCode = "0";
    }
    callback(response);
  };

  this.verifyAdminEmailService = async (params, callback) => {
    let userData = params.params.auth;
    let response = {};
    if (!userData) {
      response.error = true;
      response.message = "Token has Expired. Login Again !";
      callback(response);
    } else {
      let userDaoResults = await this.getAdminByIdDao(userData.uid);
      if (userDaoResults.error) {
        response.error = true;
        response.message = "User not found";
        callback(response);
      } else {
        if (userDaoResults.result.email_verified) {
          response.error = true;
          response.message = "Email already verified !";
          callback(response);
        } else {
          if (params.body.otp == userDaoResults.result.email_OTP) {
            userDaoResults = await this.mailVerifiedDao(userData);
            if (userDaoResults.error) {
              callback(userDaoResults);
            } else {
              response.error = false;
              response.message = "Email verified successfully";
              callback(response);
            }
          } else {
            response.error = true;
            response.message = "Incorrect OTP";
            callback(response);
          }
        }
      }
    }
  };

  this.sendAdminOTPMailService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    /** GENERATING OTP */
    const mailOTP = Math.floor(100000 + Math.random() * 900000);
    let userDaoResults = await this.updateAdminEmailOTPDao({
      uid: auth.uid,
      otp: mailOTP,
    });
    if (userDaoResults.error) {
      response.error = true;
      response.message = userDaoResults.result;
      callback(response);
    } else {
      let mailRequest = params.auth;
      mailRequest.otp = mailOTP;
      this.sendVerifyMail(mailRequest, function (mailResponse) {
        response.error = false;
        response.message = "Email OTP Sent";
        callback(response);
      });
    }
  };

  this.getCurrencyListService = async (callback) => {
    var adminDaoResults = await this.getCurrencyListDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.currencyList = adminDaoResults.result;
    }
    callback(response);
  };

  this.getCoinPairsService = async (callback) => {
    var adminDaoResults = await this.getCoinsPairsDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.coinPairList = adminDaoResults.result;
    }
    callback(response);
  };

  this.updateCoinStatusService = async (params, callback) => {
    let coinPariData = {
      coin_value: params.coin_value,
      currency_value: params.currency_value,
      current_price: params.current_price,
      commission: params.commission,
      bot_status: params.bot_status,
      buyer_fees: params.buyer_fees,
      seller_fees: params.seller_fees,
      minimum_price: params.minimum_price,
      maximum_price: params.maximum_price,
      minimum_quantity: params.minimum_quantity,
      maximum_quantity: params.maximum_quantity,
      market_up: params.market_up,
      active: params.active == "true" || params.active == true ? 1 : 0,
      is_p2pTrade: params.is_p2pTrade == "true" || params.is_p2pTrade == true ? 1 : 0,
    };
    var adminDaoResults = await this.updateCoinStatusDao(
      coinPariData,
      params.coinId
    );
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Coin status updated";
      response.errorCode = "0";
    }
    callback(response);
    let cid = params.coinId.replace("/", "_");
    fsDB.collection(`coins`).doc(cid).update(coinPariData);
  };

  this.getUserKycListService = async (params, callback) => {
    let uid = "";
    if (params.uid.toLowerCase() != "all") {
      uid = params.uid;
    }
    var adminDaoResults = await this.getUserKycListDao(uid);
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "success";
      response.errorCode = "0";
      response.userKycList = adminDaoResults.result;
    }
    callback(response);
  };

  this.updateUserKycStatusService = async (params, callback) => {
    let idProof_verified = 0;
    let addressProof_verified = 0;
    if (params.idProof_verified == "true" || params.idProof_verified == true) {
      idProof_verified = 1;
    }
    if (
      params.addressProof_verified == "true" ||
      params.addressProof_verified == true
    ) {
      addressProof_verified = 1;
    }
    if (!params.reason) {
      params.reason = "";
    }
    var adminDaoResults = await this.updateUserKycStatusDao({
      idProof_verified: idProof_verified,
      addressProof_verified: addressProof_verified,
      uid: params.uid,
      reason: params.reason,
    });
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "User Kyc updated";
      response.errorCode = "0";
    }
    callback(response);
  };

  this.getAdminRightsService = async (params, callback) => {
    let uid = "";
    if (params.uid.toLowerCase() != "all") {
      uid = params.uid;
    }
    var adminDaoResults = await this.getAdminRightsDao(uid);
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "success";
      response.errorCode = "0";
      response.adminRightsList = adminDaoResults.result;
    }
    callback(response);
  };

  this.updateAdminRightsService = async (params, callback) => {
    const auth = params.params.auth;
    const body = params.body;
    let permission = 0;
    let inserted = 0,
      updated = 0;
    let typeNames = body.typeName.split(",");
    if (body.permission == "true" || body.permission == true) {
      permission = 1;
    }
    var response = {};
    for (let tni = 0; tni < typeNames.length; tni++) {
      var adminDaoResults = await this.checkAdminRightsDao({
        type: body.type,
        typeName: typeNames[tni],
        uid: body.uid,
      });
      if (adminDaoResults.error) {
        response.error = true;
        response.message = adminDaoResults.result;
        response.errorCode = "0";
      } else {
        if (adminDaoResults.result) {
          let apId = adminDaoResults.result.apId;
          adminDaoResults = await this.updateAdminRightsDao({
            apId: apId,
            permission: permission,
            updatedBy: auth.uid,
          });
          if (adminDaoResults.error) {
            response.error = true;
            response.message = adminDaoResults.result;
            response.errorCode = "0";
            callback(response);
          } else {
            ++updated;
          }
        } else {
          adminDaoResults = await this.insertAdminRightsDao({
            uid: body.uid,
            type: body.type,
            typeName: typeNames[tni],
            permission: permission,
            updatedAt: auth.uid,
          });
          if (adminDaoResults.error) {
            response.error = true;
            response.message = adminDaoResults.result;
            response.errorCode = "0";
            callback(response);
          } else {
            ++inserted;
          }
        }
      }
    }
    response.error = false;
    response.message =
      inserted + " Admin rights inserted." + updated + " Admin rights updated";
    response.errorCode = "0";
    callback(response);
  };

  this.getCoinListService = async (params, callback) => {
    var adminDaoResults = await this.getCoinListDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.coinList = adminDaoResults.result;
    }
    callback(response);
  };

  this.addCoinPairService = async (params, callback) => {
    var adminDaoResults = await this.checkCoinPairDao({
      coin: params.coin,
      currency: params.currency,
    });
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      if (adminDaoResults.result && adminDaoResults.result.length) {
        response.error = true;
        response.message = "Coin pair already exists";
        response.errorCode = "1";
      } else {
        adminDaoResults = await this.getCoinByCoinName({ coin: params.coin });
        if (adminDaoResults.error) {
          response.error = true;
          response.message = adminDaoResults.result;
          response.errorCode = "0";
        } else {
          if (adminDaoResults.result) {
            let coinDetails = adminDaoResults.result;
            let coinPariData = {
              coinId: params.coin + "/" + params.currency,
              coinName: coinDetails.coinName,
              coin: params.coin,
              currency_id: params.currency,
              coinLogo: coinDetails.coinLogo,
              coin_value: params.coin_value,
              currency_value: params.currency_value,
              current_price: params.current_price,
              last_price: params.current_price,
              commission: params.commission,
              bot_status: params.bot_status,
              buyer_fees: params.buyer_fees,
              seller_fees: params.seller_fees,
              minimum_price: params.minimum_price,
              maximum_price: params.maximum_price,
              minimum_quantity: params.minimum_quantity,
              maximum_quantity: params.maximum_quantity,
              market_up: params.market_up,
              active: params.active == "true" || params.active == true ? 1 : 0,
            };
            adminDaoResults = await this.addCoinPairDao(coinPariData);
            if (adminDaoResults.error) {
              response.error = true;
              response.message = adminDaoResults.result;
              response.errorCode = "0";
            } else {
              response.error = false;
              response.message = "Coin pair added successfully";
              response.errorCode = "0";
              let cid = params.coin + "_" + params.currency;
              fsDB.collection(`coins`).doc(cid).set(coinPariData)
            }
          } else {
            response.error = true;
            response.message = "Invalid coin";
            response.errorCode = "1";
          }
        }
      }
    }
    callback(response);
  };

  this.updateP2PcoinPairService = async (params, callback) => {
    console.log(params,"UPDATE p2p coin pair")
    var adminDaoResults = await this.checkCoinPairDao({
      coin: params.coin,
      currency: params.currency,
    });
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      if (adminDaoResults.result && adminDaoResults.result.length) {
        let coinDetails = adminDaoResults.result[0];
        let coinPariData = {
          is_p2pTrade: (params.is_p2pTrade == "true" || params.is_p2pTrade == true ? 1 : 0),
          p2p_transactionFee: params.p2p_transactionFee,
          p2p_markPrice: params.p2p_markPrice,
          p2p_active: params.p2p_active,
        };
        adminDaoResults = await this.updateP2PcoinPairDao(
          coinPariData,
          coinDetails.coinId
        );
        console.log(adminDaoResults)
        if (adminDaoResults.error) {
          response.error = true;
          response.message = adminDaoResults.result;
          response.errorCode = "0";
        } else {
          response.error = false;
          response.message = "P2P Coin pair updated successfully";
          response.errorCode = "0";
        }
      } else {
        response.error = true;
        response.message = "Coin pair does not exists";
        response.errorCode = "1";
      }
    }
    callback(response);
  };

  this.getP2PcoinPairService = async (params, callback) => {
    var adminDaoResults = await this.getP2PCoinPairListDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.coinList = adminDaoResults.result;
    }
    callback(response);
  };

  this.getUserWalletService = async (params, callback) => {
    var adminDaoResults = await this.getUserWalletListDao(params.uid);
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
      callback(response);
    } else {
      callback(response);
     /* coinBase.getAccounts({}, function (err, accounts) {
        console.log(err);
        let coinbaseWallets = err ? [] : accounts;
        let binanceWallets = [];
        binance.balance((binanceErr, balances) => {
          console.log(binanceErr);
          binanceWallets = binanceErr ? [] : balances;
          response.error = false;
          response.message = "Success";
          response.errorCode = "0";
          response.walletList = adminDaoResults.result;
          response.coinBaseWallets = coinbaseWallets.map((wallet) => ({
            id: wallet.id,
            name: wallet.name,
            balance: wallet.balance.amount,
            coin: wallet.balance.currency,
            nativeBalance: wallet.native_balance.amount,
            nativeCurrency: wallet.native_balance.currency,
          }));
          response.binanceWallets = Object.entries(binanceWallets)
            .filter(([key]) =>
              coinbaseWallets
                .map(({ balance }) => balance.currency)
                .includes(key)
            )
            .map(([key, value]) => ({ coin: key, ...value }));
          callback(response);
        });
      });*/
    }
  };

  this.getUserTransactionService = async (params, callback) => {
    var adminDaoResults = await this.getUserBlockchainTransactionDao();
    var response = {};
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "0";
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.transactions = adminDaoResults.result;
    }
    callback(response);
  };

  this.sendMailNotificationService = async (data,callback) => {
    var response = {};
    this.sendMailNotification(data, function (mailResponse) {
      if (mailResponse) {
        response.error = false;
        response.message = "Email Sent";
      } else {
        response.error = true;
        response.message = "Something went wrong while sending Email";
      }
      callback(response);
    });
  };

  this.getAllTradesService = async (params, callback) => {
    var response = {};
    // let body = params.body;
    // let auth = params.params.auth;
    let tradeDaoResults = await this.getAllTradesDao();
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.recentTradeList = tradeDaoResults.result;
      callback(response);
    }
  };

  this.getAllTradeErrorsService = async (params, callback) => {
    var response = {};
    // let body = params.body;
    // let auth = params.params.auth;
    let tradeDaoResults = await this.getAllTradesErrorsDao(null);
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.tradeErrors = tradeDaoResults.result;
      callback(response);
    }
  };

  this.updateTradeErrorOrdersService = async (params, callback) => {
    var response = {};
    let tradeDaoResults = await this.getAllTradesErrorsDao(params.teoId);
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      let tradeDetails = tradeDaoResults.result[0]
      if(tradeDetails.status =="PENDING"){
        let status = params.status.toUpperCase()
        let updateDao = await this.updateErrorTrade_adminDao({"status":status},params.teoId)
        if(updateDao.error == false){
         response.error = false;
         response.message = "Success";
         response.errorCode = "0";
         callback(response);
        }else{
          callback(updateDao)
        }
      }else{
        response.error = true;
        response.message = "Order must be on pending status to update";
        response.errorCode = "0";
        callback(response);
      }
    }
  };

  this.updateUserProfileAdminService = async (params, callback) => {
    var response = {}
    const body = params;
    let user = {}
    let adminDaoResults = await this.checkMetaMaskAddressDao(body.metaMaskWallet);
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      if(adminDaoResults.result){
        response.error = true;
        response.message = "User "+adminDaoResults.result.firstName+" "+adminDaoResults.result.lastName+ " ("+adminDaoResults.result.email+") "+"has already using the same meta mask wallet address. So could not update !";
        response.errorCode = "1";
        callback(response);
      }else{
        if (body.metaMaskWallet && body.metaMaskWallet != 'null') {
          user.metaMaskWallet = body.metaMaskWallet;
        }
        let userDaoResults = await this.updateUserProfileDao(
          user,
          body.uid
        );
        response.error = false;
        response.message = "Meta mask wallet updated successfully !";
        response.errorCode = "0";
        callback(response);
      }
    }
  }

  this.getModuleCommissionService = async (params, callback) => {
    var response = {}
    let adminDaoResults = await this.getModuleCommissionDao(null);
    if (adminDaoResults.error) {
      response.error = true;
      response.message = adminDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.commissionDetails = adminDaoResults.result;
      callback(response);
    }
  }
};
