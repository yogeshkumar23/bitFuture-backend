const { response } = require("express");
const { param } = require("express/lib/request");

module.exports = function (server) {
  require("../dao/userDao")(server.db);
  require("../utility/common")();
  const axios = require("axios");
  const fbAdmin = global.firebase;
  const fsDB = fbAdmin.firestore();
  var coinBase = server.coinBase;
  const fs = require("fs");
  var cryptoService = require('./cryptoService')

  this.checkEmailAvailableService = async (params, callback) => {
    var response = {};
    let userDaoResults = await this.checkUserEmailDao(params);
    if (userDaoResults.error) {
      response.error = true;
      response.message = "Email Already in Use";
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Email Not Used";
      response.errorCode = "0";
      callback(response);
    }
  };

  this.userRegisterService = async (params, callback) => {
    var response = {};
    let checkMail = await this.checkUserEmailDao(params);
    if (checkMail.error) {
      response.error = true;
      response.message = "Email Already in Use";
      response.errorCode = "1";
      callback(response);
    } else {
      fbAdmin
        .auth()
        .createUser({
          displayName: params.firstName + " " + params.lastName,
          email: params.email,
          password: params.password,
        })
        .then(function (userRecord) {
          params.uid = userRecord.uid;
          fsDB
            .collection("users")
            .doc(userRecord.uid)
            .set({
              firstName: params.firstName,
              lastName: params.lastName,
              email: params.email,
              referalCode: params.referalCode,
              userType: 3,
              createdTime: new Date(),
            })
            .then(function (userDoc) {
              fbAdmin
                .auth()
                .setCustomUserClaims(userRecord.uid, { admin: false })
                .catch(function (error) {
                  console.log("Error adding admin:", error);
                });
              /** GENERATING OTP */
              //const mailOTP =Math.floor(100000 + Math.random() * 900000)
              //params.otp = mailOTP
              /** GENERATING HASH PASSWORD */
              this.generatehash(params.password, function (passwordResponse) {
                params.hash = passwordResponse;
                this.generatePassword(params, async function (result) {
                  params.password = result.hashPassword;
                  let userDaoResults = await this.addUserDao(params);
                  if (userDaoResults.error) {
                    response.error = true;
                    response.message =
                      "User Not Added. Try Again ! " + userDaoResults.result;
                    response.errorCode = "1";
                    callback(response);
                  } else {
                    response.error = false;
                    response.message = "User Added Successfully";
                    response.errorCode = "0";
                    this.insertUserKycDao({
                      uid: params.uid,
                      email: params.email,
                    });
                    //userDaoResults = await this.getUserByIdDao(userDaoResults.result)
                    let userData = {
                      firstName: params.firstName,
                      email: params.email,
                      uid: params.uid,
                    };
                    let token = await this.generateToken(
                      userData,
                      process.env.JWT_SECRET,
                      "5h"
                    );
                    userData.accessToken = token;
                    userData.type = "Register";
                    callback(response);
                    this.sendVerifyMail(userData, function (mailResponse) {
                      //callback(response)
                    });
                    this.insertUserWalletService({ uid: params.uid });
                  }
                });
              });
            })
            .catch(function (error) {
              console.log(error);
              response.error = true;
              response.message = error;
              response.errorCode = "0";
              callback(response);
            });
        })
        .catch(function (error) {
          response.error = true;
          response.message = error;
          response.errorCode = "0";
          callback(response);
        });
    }
  };

  this.verifyUserMailService = async (params, callback) => {
    let userData = params.params.auth;
    let response = {};
    if (!userData) {
      response.error = true;
      response.message = "Token has Expired. Login Again !";
      callback(response);
    } else {
      let userDaoResults = await this.getUserByIdDao(userData.uid);
      if (userDaoResults.error) {
        response.error = true;
        response.message = "User not found";
        callback(response);
      } else {
        if (userDaoResults.result.email_OTP_verified) {
          response.error = true;
          response.message = "Email already verified !";
          callback(response);
        } else {
          if (params.body.otp == userDaoResults.result.email_OTP) {
            userDaoResults = await this.mailOTPverifiedDao(userData);
            // console.log(userDaoResults);
            if (userDaoResults.error) {
              callback(userDaoResults);
            } else {
              response.error = false;
              response.message = "Email OTP verified successfully";
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

  this.verifyUserEmailWithoutOTPService = async (params, callback) => {
    let userData = params.auth;
    let response = {};
    if (!userData) {
      response.error = true;
      response.message = "Token has Expired. Login Again !";
      callback(response);
    } else {
      let userDaoResults = await this.getUserByIdDao(userData.uid);
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
          userDaoResults = await this.mailVerifiedDao(userData);
          if (userDaoResults.error) {
            callback(userDaoResults);
          } else {
            response.error = false;
            response.message = "Email verified successfully";
            callback(response);
          }
        }
      }
    }
  };

  this.userLoginService = async (params, callback) => {
    var userCred = params.body;
    var response = {};
    let userDaoResults = await this.checkUserEmailDao(userCred);
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
      if (userDaoResults.is_Suspended) {
        let currentDate = new Date(new Date().toISOString().slice(0, 10));
        let suspendDate = new Date(userDaoResults.suspend_Till);
        if (suspendDate.getTime() >= currentDate.getTime()) {
          response.error = true;
          response.message = "Account Suspended";
          response.errorCode = "1";
          sessionParams.status = "Failed";
          sessionParams.description = response.message;
          this.addSessionHistoryDao(sessionParams);
          callback(response);
          this.sendLoginNotification(sessionParams);
          return;
        } else {
          this.removeUserSuspendDao(userDaoResults.uid);
        }
      } else if (userDaoResults.is_Baned) {
        response.error = true;
        response.message = "Account Banned";
        response.errorCode = "1";
        sessionParams.status = "Failed";
        sessionParams.description = response.message;
        this.addSessionHistoryDao(sessionParams);
        callback(response);
        return;
      } else if (!userDaoResults.email_verified) {
        response.error = true;
        response.message = "Email Not Verified";
        response.errorCode = "1";
        sessionParams.status = "Failed";
        sessionParams.description = response.message;
        this.addSessionHistoryDao(sessionParams);
        this.sendLoginNotification(sessionParams);
        callback(response);
        return;
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
          };
          response.user = userData;
          response.accessToken = await this.generateToken(
            userData,
            process.env.JWT_SECRET,
            "30d"
          );
          if (userDaoResults.enableTwoFactor == 1) {
            const mailOTP = Math.floor(100000 + Math.random() * 900000);
            userDaoResults = await this.updateUserEmailOTPDao({
              uid: userDaoResults.uid,
              otp: mailOTP,
            });
            if (userDaoResults.error) {
              response.error = true;
              response.message = userDaoResults.result;
              callback(response);
            } else {
              let mailRequest = Object.assign({}, userData);
              mailRequest.otp = mailOTP;
              this.sendVerifyMail(mailRequest, function (mailResponse) {
                response.error = false;
                response.message = "Login Successfull.Email OTP Sent !";
                sessionParams.status = "Complete";
                sessionParams.description = "Logged In successfully";
                this.addSessionHistoryDao(sessionParams);
                this.sendLoginNotification(sessionParams);
                callback(response);
              });
            }
          } else {
            response.error = false;
            response.message = "Login Successfull";
            sessionParams.status = "Complete";
            sessionParams.description = "Logged In successfully";
            this.addSessionHistoryDao(sessionParams);
            this.sendLoginNotification(sessionParams);
            callback(response);
          }
        } else {
          response.error = true;
          response.message = "Email and Password does not match";
          response.errorCode = "1";
          sessionParams.status = "Failed";
          sessionParams.description = "Entered wrong password";
          this.addSessionHistoryDao(sessionParams);
          this.sendLoginNotification(sessionParams);
          callback(response);
        }
      } catch (e) {
        response.error = true;
        response.message = "Something went wrong. Try again!" + e;
        response.errorCode = "1";
        sessionParams.status = "Failed";
        sessionParams.description = e;
        this.addSessionHistoryDao(sessionParams);
        this.sendLoginNotification(sessionParams);
        callback(response);
      }
    } else {
      response.error = true;
      response.message = "Email not registered";
      response.errorCode = "1";
      callback(response);
    }
  };

  this.getUserProfileService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    let userDaoResults = await this.getUserProfileDao(auth.uid);
    if (userDaoResults.error) {
      response.error = true;
      response.message = userDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userDetails = userDaoResults.result;
      callback(response);
    }
  };

  this.updateUserProfileService = async (params, callback) => {
    const auth = params.params.auth;
    const body = params.body;
    var response = {};
    let user = {
      firstName: body.firstName,
      lastName: body.lastName,
      phoneNumber: body.phoneNumber,
      signature:body.signature,
      metaMaskWallet:body.metaMaskWallet ? body.metaMaskWallet : ""
    };
    if (params.file) {
      const imageUrl = "/uploads/user/profile/";
      user.profileImage = imageUrl + params.file.filename;
    }
    if (body.removeProfileImage == "true" || body.removeProfileImage == true) {
      user.profileImage = null;
    }
    if (body.password) {
      /** GENERATING HASH PASSWORD */
      this.generatehash(body.password, function (hash) {
        this.generatePassword(
          { hash: hash, password: body.password },
          async function (result) {
            user.password = result.hashPassword;
            let userDaoResults = await this.updateUserProfileDao(
              user,
              auth.uid
            );
            if (userDaoResults.error) {
              response.error = true;
              response.message = "Profile update failed. Try Again !";
              response.errorCode = "1";
            } else {
              response.error = false;
              response.message = "Profile updated successfully.";
              response.errorCode = "0";
            }
            callback(response);
          }
        );
      });
    } else {
      let userDaoResults = await this.updateUserProfileDao(user, auth.uid);
      if (userDaoResults.error) {
        response.error = true;
        response.message = "Profile update failed. Try Again !";
        response.errorCode = "1";
      } else {
        response.error = false;
        response.message = "Profile updated successfully.";
        response.errorCode = "0";
      }
      callback(response);
    }
    if(body.password){
      delete user.password
    }
    fsDB.collection(`users`).doc(auth.uid).update(user)
  };

  this.checkUserPasswordService = async (params, callback) => {
    const auth = params.params.auth;
    const body = params.body;
    let userDaoResults = await this.getUserByIdDao(auth.uid);
    if (userDaoResults.error) {
      response.error = true;
      response.message = "Something went wrong. Try again !";
      response.errorCode = "1";
    } else {
      userDaoResults = userDaoResults.result;
      let checkPassword = await this.comparePassword(
        userDaoResults,
        body.password
      );
      if (checkPassword) {
        response.error = false;
        response.message = "Password verified.";
        response.errorCode = "0";
      } else {
        response.error = true;
        response.message = "Wrong Password";
        response.errorCode = "1";
      }
    }
    callback(response);
  };

  this.sendUserOTPMailService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    /** GENERATING OTP */
    const mailOTP = Math.floor(100000 + Math.random() * 900000);
    let userDaoResults = await this.updateUserEmailOTPDao({
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

  this.updateUserTwoFactorService = async (params, callback) => {
    const auth = params.params.auth;
    var response = {};
    let status = params.body.status.toLowerCase() == "true" ? 1 : 0;
    let userDaoResults = await this.updateUserTwoFactorDao({
      uid: auth.uid,
      enable: status,
    });
    if (userDaoResults.error) {
      response.error = true;
      response.message = userDaoResults.result;
      callback(response);
    } else {
      response.error = false;
      response.message = "Updated Successfully";
      callback(response);
    }
  };

  this.getUserSessionHistoryService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    let userDaoResults = await this.getSessionHistoryDao(auth.uid);
    if (userDaoResults.error) {
      response.error = true;
      response.sessionHistory = userDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userDetails = userDaoResults.result;
      callback(response);
    }
  };

  this.getUserSessionHistoryService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    let userDaoResults = await this.getSessionHistoryDao(auth.uid);
    if (userDaoResults.error) {
      response.error = true;
      response.sessionHistory = userDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userDetails = userDaoResults.result;
      callback(response);
    }
  };

  this.updateUserKYCService = async (params, callback) => {
    const auth = params.params.auth;
    const imageUrl = "/uploads/user/documents/";
    var response = {};
    var documents = params.files;
    var data = params.body;
    data.uid = auth.uid;
    if (documents) {
      if (documents.documentPhotoFront && documents.documentPhotoFront[0]) {
        data.documentFront =
          imageUrl + documents.documentPhotoFront[0].filename;
      } else {
        data.documentFront = "";
      }
      if (documents.documentPhotoBack && documents.documentPhotoBack[0]) {
        data.documentBack = imageUrl + documents.documentPhotoBack[0].filename;
      } else {
        data.documentBack = "";
      }
      if (documents.userPicture && documents.userPicture[0]) {
        data.userPicture = imageUrl + documents.userPicture[0].filename;
      } else {
        data.userPicture = "";
      }
      if (documents.addressProofPhoto && documents.addressProofPhoto[0]) {
        data.addressProofPhoto =
          imageUrl + documents.addressProofPhoto[0].filename;
      } else {
        data.addressProofPhoto = "";
      }
    }
    if (data.isResubmitted && data.isResubmitted == "true") {
      data.isResubmitted = 1;
    } else {
      data.isResubmitted = 0;
    }
    if (!data.reason) {
      data.reason = "";
    }
    let userDaoResults = await this.updateUserKYCDao(data);
    if (userDaoResults.error) {
      response.error = true;
      response.sessionHistory = userDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userDetails = userDaoResults.result;
      callback(response);
    }
  };

  this.getUserKYCService = async (params, callback) => {
    const auth = params.auth;
    var response = {};
    let userDaoResults = await this.getUserKYCDao(auth.uid);
    if (userDaoResults.error) {
      response.error = true;
      response.message = userDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userKyc = userDaoResults.result;
      callback(response);
    }
  };

  this.userResetPasswordMailService = async (params, callback) => {
    var response = {};
    let userDaoResults = await this.checkUserEmailDao(params);
    if (userDaoResults.error) {
      userDaoResults = userDaoResults.result;
      let userData = {
        firstName: userDaoResults.firstName,
        email: userDaoResults.email,
      };
      let token = await this.generateToken(
        userData,
        process.env.JWT_SECRET,
        "5h"
      );
      let mailRequest = userData;
      mailRequest.token = token;
      this.sendForgotPasswordMail(mailRequest, function (mailResponse) {
        response.error = false;
        response.message = "Email Sent";
        callback(response);
      });
      this.enablePasswordReset({ uid: userDaoResults.uid, enable: 1 });
    } else {
      response.error = true;
      response.message = "Email not registered";
      response.errorCode = "1";
      callback(response);
    }
  };

  this.userChangePasswordService = async (params, callback) => {
    var response = {};
    var auth = await this.getDataFromToken(
      params.token,
      process.env.JWT_SECRET
    );
    if (auth.error) {
      response.error = true;
      response.msg = "Token is either invalid or expired !";
      callback(response);
    } else {
      let user = auth.data;
      var userDaoResults = await this.checkUserEmailDao(user);
      if (userDaoResults.error) {
        userDaoResults = userDaoResults.result;
        if (userDaoResults.passwordReset_enabled) {
          /** GENERATING HASH PASSWORD */
          this.generatehash(params.password, function (passwordResponse) {
            params.hash = passwordResponse;
            this.generatePassword(params, async function (result) {
              params.password = result.hashPassword;
              let updateResult = await this.changeUserPassword({
                uid: userDaoResults.uid,
                password: result.hashPassword,
              });
              if (updateResult.error) {
                response.error = true;
                response.message = updateResult.result;
                response.errorCode = "1";
                callback(response);
              } else {
                response.error = false;
                response.message = "Password Changed Successfully";
                response.errorCode = "0";
                callback(response);
              }
            });
          });
        } else {
          response.error = true;
          response.message = "Password already changed Using this token.";
          response.errorCode = "1";
          callback(response);
        }
      } else {
        response.error = true;
        response.message = "Email not registered";
        response.errorCode = "1";
        callback(response);
      }
    }
  };

  this.userGetWalletService = async (params, callback) => {
    var response = {};
    const auth = params.params.auth;
    const data = params.body;
    if (data.coinId.toLowerCase() == "all") {
      let userDaoResults = await this.getFullUserWallet(auth.uid);
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.userWallet = userDaoResults.result;
      callback(response);
    } else {
      let userDaoResults = await this.getCoinDetailsByIdDao(data.coinId);
      if (userDaoResults.error) {
        callback(userDaoResults);
      } else {
        let coinData = userDaoResults.result;
        userDaoResults = await this.getUserWalletByTypeDao({
          uid: auth.uid,
          coin: coinData.coin,
          currency: coinData.currency_id,
          type: "COIN",
        });
        response.error = false;
        response.message = "Success";
        response.errorCode = "0";
        response.coinData = coinData;
        response.userWallet = userDaoResults.result;
        callback(response);
      }
    }
  };

  this.userGetTransactionsService = async (params, callback) => {
    var response = {};
    const auth = params.params.auth;
    let userDaoResults = await this.getBlockchainTransactionDao(auth.uid);
    if (userDaoResults.error) {
      callback(userDaoResults);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.transactions = userDaoResults.result;
      callback(response);
    }
  };

  this.userGetWalletAddressService = async (params, callback) => {
    var response = {};
    const auth = params.params.auth;
    const data = params.body;
    let userDaoResults = await this.getCoinDetailsByIdDao(data.coinId);
    if (userDaoResults.error) {
      callback(userDaoResults);
    } else {
      let coinData = userDaoResults.result;
      userDaoResults = await this.getUserWalletByTypeDao({
        uid: auth.uid,
        coin: coinData.coin,
        currency: coinData.currency_id,
        type: data.type,
      });
      // console.log(userDaoResults);
      if (userDaoResults.result[0].walletAddress === "") {
        try {
          coinBase.getAccounts({}, function (err, accounts) {
            let accountDetails;
            console.log(err);
            if (!err) {
              accountDetails = accounts.find(
                (account) =>
                  account.currency === userDaoResults.result[0].typeId
              );
            }
            // console.log(accountDetails);
            if (accountDetails) {
              coinBase.getAccount(accountDetails.id, function (err, account) {
                console.log(err);
                if (!err) {
                  account.createAddress(
                    { name: auth.uid },
                    async function (err, addressResponse) {
                      console.log(err);
                      let updateQuery = {
                        walletAddress: addressResponse.address,
                        accountId: accountDetails.id,
                      };
                      // console.log(
                      //   "Params",
                      //   updateQuery,
                      //   auth.uid,
                      //   accountDetails.currency
                      // );
                      await this.updateWalletForUserDao(
                        updateQuery,
                        auth.uid,
                        accountDetails.currency
                      );
                      response.error = false;
                      response.message = "Success";
                      response.errorCode = "0";
                      response.userWallet = [
                        {
                          ...userDaoResults.result[0],
                          ...updateQuery,
                        },
                      ];
                      callback(response);
                    }
                  );
                }
              });
            }
          });
        } catch (e) {
          console.log(e);
          response.error = false;
          response.message = "Success";
          response.errorCode = "0";
          response.userWallet = userDaoResults.result;
          callback(response);
        }
      } else {
        response.error = false;
        response.message = "Success";
        response.errorCode = "0";
        response.userWallet = userDaoResults.result;
        callback(response);
      }
    }
  };

  this.insertUserWalletService = async (params) => {
    var coinPairs = await this.getCoinPairsDao();
    if (coinPairs.error == false) {
      coinPairs = coinPairs.result;
      var insertQuery = [];
      var addedCoins = [];
      var addedCurrency = [];
      for (let cp = 0; cp < coinPairs.length; cp++) {
        let uniqueId = this.makeUniqueID(20);
        if (addedCurrency.indexOf(coinPairs[cp].currency_id) == -1) {
          let inq = {
            walletId: uniqueId,
            uid: params.uid,
            type: "AMOUNT",
            typeId: coinPairs[cp].currency_id,
            balance: 0,
            active: 1,
            walletAddress: "",
            accountId: "",
          };
          insertQuery.push(inq);
          addedCurrency.push(coinPairs[cp].currency_id);
        }
        if (addedCoins.indexOf(coinPairs[cp].coin) == -1) {
          uniqueId = this.makeUniqueID(20);
          let inq = {
            walletId: uniqueId,
            uid: params.uid,
            type: "COIN",
            typeId: coinPairs[cp].coin,
            balance: 0,
            active: 1,
            walletAddress: "",
            accountId: "",
          };
          insertQuery.push(inq);
          addedCoins.push(coinPairs[cp].coin);
        }
      }
      this.inserNewWalletForUserDao(insertQuery);
    }
  };

  this.getTransactionEventService = async (data) => {
    let itemData = data.data.item;
    let symbol = itemData.unit;
    let transactionId = itemData.transactionId;
    let amount = parseFloat(itemData.amount),
      userId,
      address = itemData.address;
    let checkWalletAddress = await this.checkWalletAddressDao(address);
    if (checkWalletAddress.error === false) {
      userId = checkWalletAddress.result.uid;
      let findTransaction = await this.checkTransactionByIdDao(transactionId);
      if (findTransaction.error === false) {
        let findUser = await this.checkUserByIdDao(userId);
        if (findUser.error === false) {
          await this.insertUserWalletTransactionDao({
            transactionId: transactionId,
            transactionTime: itemData.minedInBlock.timestamp,
            coin: symbol,
            walletAddress: address,
            amount: amount,
          });
          await this.updateUserWalletByTransaction(userId, amount, symbol);
        }
      }
    }
  };

  this.getCallbackEvent1Service = async (params, callback) => {
    console.log(params);
    try {
      let filePath = __dirname + "/../logs/";
      let fileData = {
        reponse: params,
        logDate: new Date().toISOString(),
      };
      fs.appendFileSync(
        filePath + "deposit-log.txt",
        JSON.stringify(fileData) + "\n\n"
      );
    } catch (e) {
      console.log(e);
    }
    if (params.type == "wallet:addresses:new-payment") {
      let transactionDetails = {};
      transactionDetails.transactionId = params.additional_data.transaction.id;
      transactionDetails.address = params.data.address;
      let checkWalletAddress = await this.checkWalletAddressDao(
        transactionDetails.address
      );
      if (checkWalletAddress.error === false) {
        let userId = checkWalletAddress.result.uid;
        transactionDetails.uid = userId;
        let findTransaction = await this.checkBlockChainTransactionByIdDao(
          transactionDetails.transactionId
        );
        if (findTransaction.error === false) {
          let findUser = await this.checkUserByIdDao(userId);
          if (findUser.error === false) {
            transactionDetails.hash = params.additional_data.hash;
            transactionDetails.accountId = params.account.id;
            transactionDetails.amount = params.additional_data.amount.amount;
            transactionDetails.currency =
              params.additional_data.amount.currency;
            transactionDetails.type = "DEPOSIT";
            transactionDetails.status = "completed";
            transactionDetails.transaction_created_at = params.created_at;
            transactionDetails.api_log = JSON.stringify(params);
            await this.insertBlockchainTransactionDao(transactionDetails);
            console.log("Current Params", userId, transactionDetails);
            await this.updateUserWalletByTransaction(
              userId,
              transactionDetails.amount,
              transactionDetails.currency
            );
          }
        }
      }
    }
    callback({ status: "success", response_code: 200 });
  };

  this.sendMoneyToWalletAddress = async (params, callback) => {
    var response = {};
    const auth = params.params.auth;
    const data = params.body;
    let userDaoResults = await this.getCoinDetailsByIdDao(data.coinId);
    if (userDaoResults.error) {
      callback(userDaoResults);
    } else {
      let coinData = userDaoResults.result;
      userDaoResults = await this.getUserWalletByTypeDao({
        uid: auth.uid,
        coin: coinData.coin,
        currency: coinData.currency_id,
        type: "COIN",
      });
      let walletBalance = userDaoResults.result[0];
      if (walletBalance.balance - walletBalance.freeze < amount) {
        response.error = true;
        response.message = "Insufficient Balance";
        response.errorCode = "0";
        callback(response);
      } else {
        try {
          // Need to change after accounId removed from the user_wallet table
          coinBase.getAccount(
            userDaoResults.result[0].accountId,
            function (err, account) {
              console.log(err);
              let uniqueId = this.makeUniqueID(20);
              account.sendMoney(
                {
                  to: data.toAddress,
                  amount: data.amount,
                  currency: coinData.coin,
                  idem: uniqueId,
                },
                async function (err, tx) {
                  console.log(err, tx);
                  if (err) {
                    response.error = true;
                    response.message = "Transaction Failed";
                    response.errorCode = "0";
                  } else {
                    let transactionDetails = {};
                    transactionDetails.transactionId = tx.data.id;
                    transactionDetails.address = tx.to.address;
                    let checkWalletAddress = await this.checkWalletAddressDao(
                      transactionDetails.address
                    );
                    let userId = checkWalletAddress.error
                      ? "other_wallet_address"
                      : checkWalletAddress.result.uid;
                    transactionDetails.uid = userId;
                    let findTransaction =
                      await this.checkBlockChainTransactionByIdDao(
                        transactionDetails.transactionId
                      );
                    if (findTransaction.error === false) {
                      let findUser = await this.checkUserByIdDao(userId);
                      if (findUser.error === false) {
                        transactionDetails.hash = tx.network.hash;
                        transactionDetails.accountId = params.account.id;
                        transactionDetails.amount = tx.data.amount.amount;
                        transactionDetails.currency = tx.data.amount.currency;
                        transactionDetails.type = tx.data.type.toUpperCase();
                        transactionDetails.status = tx.data.status;
                        transactionDetails.transaction_created_at =
                          tx.created_at;
                        transactionDetails.api_log = JSON.stringify(tx);
                        await this.insertBlockchainTransactionDao(
                          transactionDetails
                        );
                        await this.updateUserWalletByTransaction(
                          userId,
                          walletBalance.balance - transactionDetails.amount,
                          transactionDetails.currency
                        );
                      }
                    } else {
                      callback(findTransaction);
                    }
                    response.error = false;
                    response.message = "Transaction Successfull";
                    response.errorCode = "0";
                  }
                  callback(response);
                }
              );
            }
          );
        } catch (e) {
          console.log(e);
          response.error = false;
          response.message = "Success";
          response.errorCode = "0";
          response.userWallet = userDaoResults.result;
          callback(response);
        }
      }
    }
  };

  this.resendUserVerificationEmailService = async (params, callback) => {
    let response = {};
    let userDaoResults = await this.getUserByEmailDao(params.email);
    if (userDaoResults.error == true) {
      response.error = true;
      response.message = userDaoResults.result;
      callback(response);
    } else if (
      userDaoResults.error == false &&
      userDaoResults.result == undefined
    ) {
      response.error = true;
      response.message = "User not found";
      callback(response);
    } else {
      if (userDaoResults.result.email_verified) {
        response.error = true;
        response.message = "Email already verified !";
        callback(response);
      } else {
        let userData = {
          firstName: userDaoResults.result.firstName,
          email: userDaoResults.result.email,
          uid: userDaoResults.result.uid,
        };
        let token = await this.generateToken(
          userData,
          process.env.JWT_SECRET,
          "5h"
        );
        userData.accessToken = token;
        userData.type = "Register";
        this.sendVerifyMail(userData, function (mailResponse) {
          if (mailResponse) {
            response.error = false;
            response.message = "Verification Email Sent Successfully!";
            callback(response);
          } else {
            response.error = true;
            response.message = "Something went Wrong! ";
            callback(response);
          }
        });
      }
    }
  };

  this.sendLoginNotification = async (data) => {
    let notificationData = {
      topic: "login",
      message: data.description,
      ipAddress: data.ipAddress,
      status: data.status,
      createdTime: new Date().getTime(),
      is_Read: false,
    };
    let notificationDoc = await fsDB
      .collection(`users`)
      .doc(data.uid)
      .collection(`notifications`)
      .doc();
    notificationDoc.set(notificationData);
  };

  /** CRYPTO WITHDRAW */
  this.userCryptoPayoutService = async (params,callback)=>{
    var response ={}
    let body = params.body
    let auth = params.params.auth
    let openingBalance = {}
    let closingBalance = {}
    if(auth.userStatus == 0){
      response.error = true
      response.message = 'Action cannot be done'
      response.errorCode = '0'
      callback(response)
      return
     }
    let failedStatus = 0
    /** WITHDRAW FEES */
    let withdrawFee = 0
    let totalAmount = parseFloat(body.amount)

    let coinDetails = await this.checkCoinDetialsByCoinDao(body.coin)
    if(coinDetails.error == true){
      callback(coinDetails)
      return
    }else{
      if(coinDetails.result == undefined){
        response.error = true
        response.result = "Not a valid crypto coin"
        callback(response)
        return
      }
    }

    withdrawFee = isNaN(parseFloat(coinDetails.result.withdrawFees)) ? 0 : parseFloat(coinDetails.result.withdrawFees)

    /** WITHDRAW VALIDATIONS */
    
    let minimumWithdrawAmount = isNaN(parseFloat(coinDetails.result.withdrawMinimum)) ? 0 : parseFloat(parseFloat(coinDetails.result.withdrawMinimum))

    if(totalAmount < (minimumWithdrawAmount+withdrawFee)){
      response.error = true
      response.message = "Withdraw minimum amount for "+coinDetails.result.coin+" is "+(minimumWithdrawAmount+withdrawFee)
      response.gateway = "BINANCE"
      callback(response)
      return
    }
    
    let maximumWithdrawAmount = isNaN(parseFloat(coinDetails.result.withdrawMaximum)) ? 0 : parseFloat(parseFloat(coinDetails.result.withdrawMaximum))
    if(totalAmount > maximumWithdrawAmount){
      response.error = true
      response.message = "Withdraw maximum amount for "+coinDetails.result.coin+" is "+coinDetails.result.withdrawMaximum
      response.gateway = "BINANCE"
      callback(response)
      return
    }


    var userWalletDao = await this.getUserWalletDao({uid:auth.uid,coin:body.coin,currency:""})
    if(userWalletDao.error == false){
      if(userWalletDao.result[0] == undefined || (userWalletDao.result[0] && (userWalletDao.result[0].balance - userWalletDao.result[0].freeze) < totalAmount)){
        response.error = true
        response.message = "User does not have sufficient balance"
        response.gateway = "BINANCE"
        callback(response)
      }else{

          let userDetails = await this.getUserByIdDao(auth.uid)
          if(userDetails.error == true){
            response.error = true
            response.message = "User does not exists"
            response.gateway = "BINANCE"
            callback(userDetails)
          }else{
            openingBalance = userWalletDao.result[0]

            /** DEDUCTING USER WALLET BALANCE BEFOR EXECUTION */
          
            await this.updateUserWalletByTransaction(auth.uid,totalAmount*-1,body.coin)
            const binance = server.binance
            let finalWithdrawAmount = binance.roundStep(totalAmount - withdrawFee,"0.00000001")
            let uniqueId = "tita"+this.makeUniqueID(10)
            try{
              let transactionTime = new Date().getTime()
              let payoutParams = {
                withdrawOrderId : uniqueId,
                coin      : body.coin,
                network   : body.network,//process.env.BINANCE_NETWORK,
                address   : body.walletAddress,
                //amount    : totalAmount - withdrawFee,
                amount    : finalWithdrawAmount,
                transactionFeeFlag:false,
                name      :userDetails.result.firstName+' '+userDetails.result.lastName+' uid-'+userDetails.result.uid,
                walletType : 0, //0-SPOT WALLET,1 - FUNDING WALLET
                timestamp : transactionTime
              } 

              var transactionResponse = await cryptoService.cryptoWithdraw(payoutParams)
               //console.log(transactionResponse)
               try{

                let filePath = __dirname+"/../logs/"
                let fileData = {"request":{
                  withdrawOrderId : uniqueId,
                  coin      : body.coin,
                  network   : body.network,
                  address   : body.walletAddress,
                  amount    : totalAmount,
                  withdrawFee:coinDetails.result.withdrawFees,
                  withdrawTradeFee:coinDetails.result.withdrawTradeFees,
                  finalWithdrawAmount:finalWithdrawAmount,
                  transactionFeeFlag:false,
                  name      :userDetails.result.firstName+' '+userDetails.result.lastName+' uid-'+userDetails.result.uid,
                  walletType : 0, //0-SPOT WALLET,1 - FUNDING WALLET
                  timestamp : transactionTime
                }}
                fileData.response = transactionResponse
                fileData.logDate = new Date().toISOString()
                fs.appendFileSync(filePath+"cryptowithdrawLogs.txt",JSON.stringify(fileData))
                }catch(e){
                  console.log(e)
                }

                if(transactionResponse.error == true){
                  let transactionData = {
                    transactionId:uniqueId,
                    address:body.walletAddress,
                    uid:auth.uid,
                    amount:totalAmount,
                    fee:withdrawFee+parseFloat(coinDetails.result.withdrawTradeFees),
                    currency:body.coin,
                    type:"WITHDRAW",
                    network:body.network,
                    status:"pending",
                    walletId:userWalletDao.result[0].walletId,
                    transaction_created_at:new Date().toISOString(),
                    api_log:JSON.stringify(transactionResponse)
                  }  
                  await this.insertWithdrawTransactionDao(transactionData)
                  response.error = true
                  response.isPending = 1
                  response.message = "Withdraw is in process"
                  callback(response) 
                }else if(transactionResponse.error == false){
                  if(transactionResponse.data.id){
                    let transactionData = {
                      transactionId:uniqueId,
                      hash:transactionResponse.data.id,
                      address:body.walletAddress,
                      uid:auth.uid,
                      amount:totalAmount,
                      fee:withdrawFee+parseFloat(coinDetails.result.withdrawTradeFees),
                      currency:body.coin,
                      type:"WITHDRAW",
                      network:body.network,
                      status:"success",
                      walletId:userWalletDao.result[0].walletId,
                      transaction_created_at:new Date().toISOString(),
                      api_log:JSON.stringify(transactionResponse)
                    }
                    await this.insertWithdrawTransactionDao(transactionData)
                    response.error = false
                    response.message = "Withdraw processing"
                    callback(response) 
                  }else{
                    let transactionData = {
                      transactionId:uniqueId,
                      address:body.walletAddress,
                      uid:auth.uid,
                      amount:totalAmount,
                      fee:withdrawFee+parseFloat(coinDetails.result.withdrawTradeFees),
                      currency:body.coin,
                      type:"WITHDRAW",
                      network:body.network,
                      status:"pending",
                      walletId:userWalletDao.result[0].walletId,
                      transaction_created_at:new Date().toISOString(),
                      api_log:JSON.stringify(transactionResponse)
                    }
                    await this.insertWithdrawTransactionDao(transactionData)
                    response.error = false
                    response.isPending = 1
                    response.message = "Withdraw is in process"
                    response.gateway = "BINANCE"
                    callback(response) 
                  }
                }
            }catch(e){
               console.log(e)
               let transactionData = {
                transactionId:uniqueId,
                address:body.walletAddress,
                uid:auth.uid,
                amount:totalAmount,
                fee:withdrawFee+parseFloat(coinDetails.result.withdrawTradeFees),
                currency:body.coin,
                type:"WITHDRAW",
                network:body.network,
                status:"pending",
                walletId:userWalletDao.result[0].walletId,
                transaction_created_at:new Date().toISOString(),
                api_log:JSON.stringify(transactionResponse)
              }
               await this.insertWithdrawTransactionDao(transactionData)
               response.error = true
               response.isPending = 1
               response.message = "Withdraw is in process"
               response.gateway = "BINANCE"
               callback(response)
            }

            try{
              closingBalance = await this.getUserWalletByTypeDao({uid:auth.uid,coin:body.coin,currency:"",type:"COIN"})
              closingBalance = closingBalance.result[0]
              let actionLogData={
               uid:auth.uid,
               type:"DEBIT",
               action:"WITHDRAW",
               walletType:openingBalance.type,
               walletTypeId:openingBalance.typeId,
               walletId:openingBalance.walletId,
               balance_opening:openingBalance.balance,
               freeze_opening:openingBalance.freeze,               
               transactionAmount:totalAmount,
               transactionType:body.coin,
               balance_closing:closingBalance.balance,
               freeze_closing:closingBalance.freeze,
              }
              await this.insertUserActionLogsDao(actionLogData)
             }catch(e){
               console.log(e)
             }
          }
      }
    }else if(userWalletDao.error == true){
      callback(userWalletDao)
    }
  }

  this.getReferralLinkService = async (params, callback) => {
    let body = params.body
    let auth = params.params.auth
    let userDaoResults = await this.getUserReferralDao({ uid: auth.uid, type: body.type })
    var response = {}
    if (userDaoResults.error === false) {
      response.error = false
      response.message = "Success"
      response.errorCode = '0'
      response.referralCode = userDaoResults.result.referral_code
      callback(response)
    } else {
      if (userDaoResults.result.length == 0) {
        let referral_code = this.makeUniqueID(5, null)
        let data = { uid: auth.uid, type: body.type, referral_code: referral_code }
        userDaoResults = await this.insertUserReferralDao(data)
        if (userDaoResults.error == false) {
          response.error = false
          response.message = "Success"
          response.errorCode = '0'
          response.referralCode = referral_code
        } else {
          response.error = true
          response.message = userDaoResults.message
          response.errorCode = '0'
        }
        callback(response)
      } else {
        response.error = true
        response.message = userDaoResults.message
        response.errorCode = '0'
        callback(response)
      }
    }
  }


  this.getReferredUsersService = async (params, callback) => {
    var response = {}
    let userDaoResults = await this.getReferredUsersDao(params.auth.uid)
    if (userDaoResults.error) {
      response.error = true
      response.message = userDaoResults.message
      response.errorCode = '1'
      callback(response)
    } else {
      response.error = false
      response.message = 'Success'
      response.errorCode = '0'
      let userLists = userDaoResults.result
      response.userLists = userLists
      /** PARENT USER */
      let parentUser = {}
      try {
        let userDaoResults = await this.getReferredByUserDao(params.auth.uid)
        if (userDaoResults.error == false) {
          if (userDaoResults.result != undefined || userDaoResults.result) {
            parentUser = userDaoResults.result
          }
        }
      } catch (e) {
        console.log(e)
      }
      response.parentUser = parentUser
      callback(response)
    }
  }


  this.checkUserKycService = async (params, callback) => {
    var response = {}
    const auth = params.params.auth
    var body = params.body
    let userDaoResults = await this.checkUserKyc2Dao({ documentNumber: body.documentNumber, documentType: body.documentType })
    if (userDaoResults.error == true) {
      response.error = true
      response.message = "This Kyc document already exists!"
      response.errorCode = '1'
      callback(response)
    } else {
      response.error = false
      response.message = "Kyc not exists"
      response.errorCode = '1'
      callback(userDaoResults)
    }
  }
  
};
