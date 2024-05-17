const { CallTracker } = require("assert");

module.exports = function (server) {
  require("../dao/tradeDao")(server.db);
  const fbAdmin = global.firebase;
  const binance = server.binance;
  const fsDB = fbAdmin.firestore();
  const fs = require("fs");

  this.getCoinsPositionService = async (params, callback) => {
    var response = {};
    let tradeDaoResults = await this.getCoinsDao();
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      let coinList = tradeDaoResults.result;
      for (let cl = 0; cl < coinList.length; cl++) {
        // if (coinList[cl].bot_status === "binance") {
        //   coinList[cl].current_price = (await binance.prices(coin))[coin];
        //   console.log(coinList[cl].current_price);
        // }
        let lastPrice = coinList[cl].last_price;
        let newPrice = coinList[cl].current_price;
        let changePercentage;
        changePercentage = newPrice - lastPrice;
        changePercentage = isNaN(changePercentage / lastPrice)
          ? 0
          : changePercentage / lastPrice;
        changePercentage = changePercentage * 100;
        changePercentage = changePercentage.toFixed(2);
        coinList[cl].price24hChange = changePercentage + "%";
      }
      response.coinList = tradeDaoResults.result;
      callback(response);
    }
  };

  this.getOrderTypesService = async (params, callback) => {
    var response = {};
    let tradeDaoResults = await this.getOrderTypesDao();
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.orderTypeList = tradeDaoResults.result;
      callback(response);
    }
  };

  this.getTrade24HourValuesService = async (params, callback) => {
    var response = {};
    let cid = params.coinId.replace("/", "_");
    var clientTime = parseInt(params.time);
    let clientDateTime = new Date(clientTime);
    let last24Time = clientDateTime.setDate(clientDateTime.getDate() - 1);
    let values = {
      "24HourChange": 0,
      "24HourChange": 0,
      "24HourHigh": 0,
      "24HourLow": 0,
      "24HourCoinVolume": 0,
      "24HourCurrencyVolume": 0,
    };
    var trades = await fsDB
      .collection(`coins`)
      .doc(cid)
      .collection(`trade_book`)
      .get();
    let coinInitialPrice = 0;
    let coinLastPrice = 0;
    trades.docs.every(async (trade_) => {
      let trade = trade_.data();
      let docId = trade_.id;
      let docTime = parseInt(docId);
      if (docTime > clientTime) {
        return false;
      }
      if (docTime >= last24Time) {
        let Coinprice = 0;
        if ([1, 4].indexOf(trade.orderType) > -1) {
          Coinprice = trade.marketPrice;
        } else {
          Coinprice = trade.limitPrice;
        }
        if (coinInitialPrice == 0) {
          coinInitialPrice = Coinprice;
        }
        values["24HourHigh"] = Math.max(Coinprice, values["24HourHigh"]);
        if (values["24HourLow"] == 0) {
          values["24HourLow"] = Coinprice;
        } else {
          values["24HourLow"] = Math.min(Coinprice, values["24HourLow"]);
        }
        values["24HourCoinVolume"] =
          trade.noOfCoins + values["24HourCoinVolume"];
        values["24HourCurrencyVolume"] =
          trade.orderTotalAmount + values["24HourCurrencyVolume"];
        coinLastPrice = trade.Coinprice;
        return true;
      }
    });
    /** CALCULATING PERCENTAGE DIFFERENCE BETWEEN TWO NUMBER */
    let changePercentage;
    changePercentage = coinLastPrice - coinInitialPrice;
    changePercentage = isNaN(changePercentage / coinInitialPrice)
      ? 0
      : changePercentage / coinInitialPrice;
    changePercentage = changePercentage * 100;
    changePercentage = changePercentage.toFixed(6);
    values["24HourChange"] = changePercentage + "%";
    response.error = false;
    response.message = "Success";
    response.coinChart = values;
    callback(response);
  };

  this.getCoinChartService = async (params, callback) => {
    var response = {};
    let type = params.type;
    let typeLimit = params.typeLimit ? params.typeLimit : null;
    let typeLimitFrom = params.typeLimitFrom ? params.typeLimitFrom : null;
    let sort = params.sort ? params.sort : "DESC";
    let limit = params.limit ? params.limit : 10;
    let offset = (params.pageNo - 1) * params.limit;
    let limitTime = isNaN(parseFloat(typeLimit)) ? 0 : parseFloat(typeLimit);
    if (limitTime > 0 && typeLimitFrom) {
      let limitDate = new Date(parseInt(typeLimitFrom));
      limitDate.setMinutes(limitDate.getMinutes() + limitTime);
      typeLimit = limitDate.getTime();
    }
    let tradeDaoResults = await this.getCoinChartByCoinId(
      { coinId: params.coinId, limit: limit, offset: offset, sort: sort },
      typeLimitFrom,
      typeLimit
    );
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      let coinChartData = tradeDaoResults.result;
      if (type == "h") {
        let fCoinTime = null;
        let fCoinData = [];
        for (let ccd = 0; ccd < coinChartData.length; ccd++) {
          if (fCoinTime == null) {
            fCoinTime = new Date(parseInt(coinChartData[ccd].createdTime));
            fCoinData.push(coinChartData[ccd]);
            fCoinTime.setHours(
              fCoinTime.getHours() + (sort == "DESC" ? -1 : +1)
            );
          } else {
            let ccdInd = new Date(parseInt(coinChartData[ccd].createdTime));
            if (fCoinTime.getHours() == ccdInd.getHours()) {
              fCoinData.push(coinChartData[ccd]);
              fCoinTime.setHours(
                fCoinTime.getHours() + (sort == "DESC" ? -1 : +1)
              );
            }
          }
        }
        response.coinChart = fCoinData;
      } else if (type == "hh") {
        let fCoinTime = null;
        let fCoinData = [];
        for (let ccd = 0; ccd < coinChartData.length; ccd++) {
          if (fCoinTime == null) {
            fCoinTime = new Date(parseInt(coinChartData[ccd].createdTime));
            fCoinData.push(coinChartData[ccd]);
            fCoinTime.setMinutes(
              fCoinTime.getMinutes() + (sort == "DESC" ? -30 : +30)
            );
          } else {
            let ccdInd = new Date(parseInt(coinChartData[ccd].createdTime));
            if (fCoinTime.getMinutes() == ccdInd.getMinutes()) {
              fCoinData.push(coinChartData[ccd]);
              fCoinTime.setMinutes(
                fCoinTime.getMinutes() + (sort == "DESC" ? -30 : +30)
              );
            }
          }
        }
        response.coinChart = fCoinData;
      } else if (type == "m") {
        response.coinChart = tradeDaoResults.result;
      } else if (type == "d") {
        let fCoinTime = null;
        let fCoinData = [];
        for (let ccd = 0; ccd < coinChartData.length; ccd++) {
          if (fCoinTime == null) {
            fCoinTime = new Date(parseInt(coinChartData[ccd].createdTime));
            fCoinData.push(coinChartData[ccd]);
            fCoinTime.setDate(fCoinTime.getDate() + (sort == "DESC" ? -1 : +1));
          } else {
            let ccdInd = new Date(parseInt(coinChartData[ccd].createdTime));
            if (fCoinTime.getDay() == ccdInd.getDay()) {
              fCoinData.push(coinChartData[ccd]);
              fCoinTime.setDate(
                fCoinTime.getDate() + (sort == "DESC" ? -1 : +1)
              );
            }
          }
        }
        response.coinChart = fCoinData;
      }
      callback(response);
    }
  };

  this.getP2PcoinPairsService = async (callback) => {
    var response = {};
    let tradeDaoResults = await this.getP2PcoinPairsDao();
    if (tradeDaoResults.error) {
      response.error = true;
      response.message = tradeDaoResults.result;
      response.errorCode = "1";
      callback(response);
    } else {
      response.error = false;
      response.message = "Success";
      response.errorCode = "0";
      response.coinPairList = tradeDaoResults.result;
      callback(response);
    }
  };

  this.placeOrderService = async (params, callback) => {
    var response = {};
    let body = params.body;
    let auth = params.params.auth;
    let openingBalance = {};
    let closingBalance = {};
    let openingBalance2 = {};
    let closingBalance2 = {};
    /** MARKET BUY  */
    if (body.orderType == 1) {
      let coin = body.coin + body.currency_id;
      let binanceCoinPrice;
      let marketPrice = 0;
      let placeQuantity = 0;
      let filters;
      let tradeFilter;

      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }

      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "AMOUNT",
        body.currency_id
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }
      openingBalance = daoResult;

      let tradeResponse;
      try {
        try {
          binanceCoinPrice = await binance.prices(coin);
          if (binanceCoinPrice[coin]) {
            marketPrice = parseFloat(binanceCoinPrice[coin]);
            placeQuantity = parseFloat(body.quantity) / marketPrice;
          } else {
            response.error = true;
            response.message = "Could not get coin price";
            callback(response);
            return;
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Could not get coin price";
          callback(response);
        }

        let coinPairExists = 0;
        try {
          tradeFilter = await binance.exchangeInfo();
          for (let obj of tradeFilter.symbols) {
            if (coin === obj.symbol) {
              coinPairExists = 1;
              filters = { status: obj.status };
              for (let filter of obj.filters) {
                if (filter.filterType == "MIN_NOTIONAL") {
                  filters.minNotional = filter.minNotional;
                } else if (filter.filterType == "PRICE_FILTER") {
                  filters.minPrice = filter.minPrice;
                  filters.maxPrice = filter.maxPrice;
                  filters.tickSize = filter.tickSize;
                } else if (filter.filterType == "LOT_SIZE") {
                  filters.stepSize = filter.stepSize;
                  filters.minQty = filter.minQty;
                  filters.maxQty = filter.maxQty;
                }
              }
              break;
            }
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (coinPairExists == 0) {
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (placeQuantity < parseFloat(filters.minQty)) {
          //placeQuantity = filters.minQty;
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            filters.minQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (marketPrice * placeQuantity > parseFloat(filters.maxQty)) {
          //placeQuantity = filters.minQty;
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum " +
            filters.maxQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (parseFloat(body.quantity) < parseFloat(filters.minNotional) + 2) {
          //placeQuantity = filters.minNotional / marketPrice;
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            (parseFloat(filters.minNotional) + 2) +
            " " +
            body.currency_id;
          callback(response);
          return;
        }

        /** DEDUCTING */

        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "AMOUNT",
          body.currency_id,
          parseFloat(body.quantity) * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "AMOUNT",
          body.currency_id
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "BUY",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: parseFloat(body.quantity),
            transactionType: body.currency_id,
            balance_closing: closingBalance.balance,
            freeze_opening: closingBalance.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }

        placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);

        tradeResponse = await binance.marketBuy(coin, placeQuantity);
        let bodyResponse = tradeResponse;
        //console.log("bodyResponse", bodyResponse);
        /*let bodyResponse = {
          symbol: 'TRXUSDT',
          orderId: 1977766147,
          orderListId: -1,
          clientOrderId: 'syeYezJQEMjaDBJPy18Ku1',
          transactTime: 1658320835505,
          price: '0.00000000',
          origQty: '145.50000000',
          executedQty: '145.50000000',
          cummulativeQuoteQty: '10.00458000',
          status: 'FILLED',
          timeInForce: 'GTC',
          type: 'MARKET',
          side: 'BUY',
          fills: [
            {
              price: '0.06876000',
              qty: '145.50000000',
              commission: '0.14550000',
              commissionAsset: 'TRX',
              tradeId: 213537467
            }
          ]
        }*/

        try {
          let filePath = __dirname + "/../logs/";
          let fileData = Object.assign({}, bodyResponse);
          fileData.reqParams = body;
          fileData.filters = filters;
          fileData.marketPrice = marketPrice;
          fileData.placeQuantity = placeQuantity;
          fileData.logDate = new Date().toISOString();
          fs.appendFileSync(
            filePath + "binanceTradeLogs.txt",
            JSON.stringify(fileData)
          );
        } catch (e) {
          console.log(e);
        }

        //if(bodyResponse.status){
        let marketprice;
        let commission;
        let commissionAsset;
        let tradeId;
        let tradeCommission;
        let tradeCommissionAsset;
        let excessQuoteQty;
        let excessQuoteAsset;
        if (bodyResponse.fills && bodyResponse.fills[0]) {
          marketprice = parseFloat(
            bodyResponse.fills[0].price ? bodyResponse.fills[0].price : 0
          );
          tradeCommission = parseFloat(
            bodyResponse.fills[0].commission
              ? bodyResponse.fills[0].commission
              : 0
          );
          tradeCommissionAsset = bodyResponse.fills[0].commissionAsset
            ? bodyResponse.fills[0].commissionAsset
            : "";
          tradeId = bodyResponse.fills[0].tradeId;
        } else {
          marketprice = 0;
          tradeCommission = 0;
          tradeCommissionAsset = "";
          tradeId = "";
        }

        try {
          let cumQuotQty = bodyResponse.cummulativeQuoteQty;
          if (parseFloat(cumQuotQty) > parseFloat(body.quantity)) {
            excessQuoteQty = parseFloat(cumQuotQty) - parseFloat(body.quantity);
            if (excessQuoteQty > 0) {
              excessQuoteAsset = body.coinPair;
              let daoResult = await this.updateUserWalletByType2Dao(
                auth.uid,
                "AMOUNT",
                body.currency_id,
                excessQuoteQty * -1
              );
            }
          }
        } catch (er2) {
          console.log(er2);
        }

        let tradeBuyQty = isNaN(parseFloat(bodyResponse.executedQty))
          ? 0
          : parseFloat(bodyResponse.executedQty);
        let finalTradeBuyQty;
        if (tradeCommissionAsset == body.coin) {
          finalTradeBuyQty = tradeBuyQty - tradeCommission;
          commission = tradeCommission;
          commissionAsset = tradeCommissionAsset;
        } else {
          //finalTradeBuyQty = tradeBuyQty
          let binanceCommission = tradeBuyQty * (0.1 / 100);
          finalTradeBuyQty = tradeBuyQty - binanceCommission;
          commission = binanceCommission;
          commissionAsset = body.coin;
        }
        let buyTradeFeesPercent = isNaN(
          parseFloat(coinDetailsDao.result.buyer_fees)
        )
          ? 0
          : parseFloat(coinDetailsDao.result.buyer_fees);
        let buyTradeFees = finalTradeBuyQty * (buyTradeFeesPercent / 100);
        finalTradeBuyQty = finalTradeBuyQty - buyTradeFees;
        let tradeEntry = {};

        tradeEntry.tradeId = this.makeUniqueID(65);
        //tradeEntry.tradeId = tradeId

        tradeEntry.orderId = bodyResponse.orderId;
        tradeEntry.uid = auth.uid;
        tradeEntry.coin = coin;
        tradeEntry.baseAsset = body.coin;
        tradeEntry.quoteAsset = body.currency_id;
        tradeEntry.status = bodyResponse.status;
        tradeEntry.filledPrice = marketprice;
        tradeEntry.amount = parseFloat(body.quantity) / marketprice;
        tradeEntry.enteredQuantity = body.quantity;
        tradeEntry.enteredQuantityAsset = body.currency_id;
        tradeEntry.noOfCoins = finalTradeBuyQty;
        tradeEntry.noOfCoinsAsset = body.coin;
        tradeEntry.walletAddress = daoResult.walletId;
        tradeEntry.orderTypeId = 1;
        tradeEntry.commission = commission;
        tradeEntry.commissionAsset = commissionAsset;
        tradeEntry.tradeCommission = tradeCommission;
        tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
        tradeEntry.feePercent = buyTradeFeesPercent;
        tradeEntry.fee = buyTradeFees;
        tradeEntry.coveringTrade = 0;
        tradeEntry.limitPrice = 0;
        tradeEntry.stopPrice = 0;
        tradeEntry.transactionTime = bodyResponse.transactTime;
        tradeEntry.clientOrderId = bodyResponse.clientOrderId;
        tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
        tradeEntry.excessQuoteQty = excessQuoteQty;
        tradeEntry.excessQuoteAsset = excessQuoteAsset;
        tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
        let addDaoResult = await this.addTradeDao(tradeEntry);
        //console.log(addDaoResult)
        if (addDaoResult.error == true) {
          console.log(addDaoResult);
        }
        //await user_update_wallet_trade("buy",auth.uid,body.coinPair,parseFloat(body.cummulativeQuoteQty),finalTradeBuyQty,body.coin)

        /** CREDITING */
        daoResult = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );

        openingBalance2 = daoResult;

        userBalance =
          parseFloat(daoResult.balance) + parseFloat(finalTradeBuyQty);
        let credit_daoResult = await this.updateUserWalletByTypeDao(
          auth.uid,
          "COIN",
          body.coin,
          userBalance
        );

        closingBalance2 = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance2 = closingBalance2;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "CREDIT",
            action: "BUY",
            walletType: openingBalance2.type,
            walletTypeId: openingBalance2.typeId,
            walletId: openingBalance2.walletId,
            balance_opening: openingBalance2.balance,
            freeze_opening: openingBalance2.freeze,
            transactionAmount: parseFloat(finalTradeBuyQty),
            transactionType: body.coin,
            balance_closing: closingBalance2.balance,
            freeze_closing: closingBalance2.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }

        response.error = false;
        response.message = "Success";
        callback(response);
        /*}else{
          response.error = true
          response.message = bodyResponse.message
          callback(response) 
        }*/
      } catch (e) {
        console.log(e);
        let errorMessage;
        if (e.body) {
          errorMessage = JSON.parse(e.body);
        } else {
          errorMessage = e;
        }
        try {
          let filePath = __dirname + "/../logs/";
          let fileData = Object.assign({}, errorMessage);
          fileData.reqParams = body;
          fileData.user = auth;
          fileData.logDate = new Date().toISOString();
          fs.appendFileSync(
            filePath + "binanceTradeLogs.txt",
            JSON.stringify(fileData)
          );
        } catch (er) {
          console.log(er);
        }
        let errorTradeData = {
          uid: auth.uid,
          orderType: body.orderType,
          amount: body.quantity,
          coin: body.coin,
          coinPair: body.currency_id,
          status: "PENDING",
          errorInfo: JSON.stringify(errorMessage),
        };
        await this.insertTradeErrorDao(errorTradeData);
        response.error = true;
        response.message = errorMessage;
        callback(response);
      }
    } else if (body.orderType == 4) {
      /** MARKET SELL  */
      let coin = body.coin + body.currency_id;
      let tradeFilter;
      let binanceCoinPrice;
      let marketPrice;
      let placeQuantity;
      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }

      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "COIN",
        body.coin
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }

      let coinPairExists = 0;
      try {
        tradeFilter = await binance.exchangeInfo();
        for (let obj of tradeFilter.symbols) {
          if (coin === obj.symbol) {
            coinPairExists = 1;
            filters = { status: obj.status };
            for (let filter of obj.filters) {
              if (filter.filterType == "MIN_NOTIONAL") {
                filters.minNotional = filter.minNotional;
              } else if (filter.filterType == "PRICE_FILTER") {
                filters.minPrice = filter.minPrice;
                filters.maxPrice = filter.maxPrice;
                filters.tickSize = filter.tickSize;
              } else if (filter.filterType == "LOT_SIZE") {
                filters.stepSize = filter.stepSize;
                filters.minQty = filter.minQty;
                filters.maxQty = filter.maxQty;
              }
            }
            break;
          }
        }
      } catch (e) {
        console.log(e);
        response.error = true;
        response.message = "Provide a valid coin pair";
        callback(response);
      }

      if (coinPairExists == 0) {
        response.error = true;
        response.message = "Provide a valid coin pair";
        callback(response);
      }

      /** STEP SIZE */

      placeQuantity = parseFloat(body.quantity)
      placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);

      if (placeQuantity < parseFloat(filters.minQty)) {
        //placeQuantity = filters.minQty;
        response.error = true;
        response.message =
          "Trade can only be executed with Minimum " +
          filters.minQty +
          " " +
          body.coin;
        callback(response);
        return;
      }

      if (placeQuantity > parseFloat(filters.maxQty)) {
        //placeQuantity = filters.minQty;
        response.error = true;
        response.message =
          "Trade can only be executed with Maximum " +
          filters.maxQty +
          " " +
          body.coin;
        callback(response);
        return;
      }

      openingBalance = daoResult;

      let tradeResponse;
      try {
        try {
          binanceCoinPrice = await binance.prices(coin);
          if (binanceCoinPrice[coin]) {
            marketPrice = parseFloat(binanceCoinPrice[coin]);
            let QuoteQuantity = parseFloat(body.quantity) * marketPrice;
            if (QuoteQuantity < parseFloat(filters.minNotional) + 1) {
              response.error = true;
              response.message =
                "Trade can only be executed with Minimum " +
                (parseFloat(filters.minNotional) + 1) +
                " " +
                body.coinPair;
              callback(response);
              return;
            }
          } else {
            response.error = true;
            response.message = "Could not get coin price";
            callback(response);
            return;
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Could not get coin price";
          callback(response);
          return;
        }

        /*body.quantity = binance.roundStep(
          parseFloat(body.quantity),
          filters.stepSize
        );*/

        /** DEDUCTING */
        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "COIN",
          body.coin,
          parseFloat(placeQuantity) * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "SELL",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: placeQuantity,
            transactionType: body.coin,
            balance_closing: closingBalance.balance,
            freeze_closing: closingBalance.freeze
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }
        tradeResponse = await binance.marketSell(
          coin,
          placeQuantity
        );
        let bodyResponse = tradeResponse;
        //console.log(bodyResponse)
        /*let bodyResponse = {
          symbol: 'TRXUSDT',
          orderId: 1977784104,
          orderListId: -1,
          clientOrderId: 'dAxQ7WV8g3E6hfN0DnttVv',
          transactTime: 1658321425404,
          price: '0.00000000',
          origQty: '145.00000000',
          executedQty: '145.00000000',
          cummulativeQuoteQty: '10.01225000',
          status: 'FILLED',
          timeInForce: 'GTC',
          type: 'MARKET',
          side: 'SELL',
          fills: [
            {
              price: '0.06905000',
              qty: '145.00000000',
              commission: '0.01001225',
              commissionAsset: 'USDT',
              tradeId: 213539559
            }
          ]
        }*/
        try {
          let filePath = __dirname + "/../logs/";
          let fileData = Object.assign({}, bodyResponse);
          fileData.reqParams = body;
          fileData.user = auth;
          fileData.filters = filters;
          fileData.placeQuantity = placeQuantity;
          fileData.logDate = new Date().toISOString();
          fs.appendFileSync(
            filePath + "binanceTradeLogs.txt",
            JSON.stringify(fileData)
          );
        } catch (e) {
          console.log(e);
        }
        let marketprice;
        let commission;
        let commissionAsset;
        let tradeCommission;
        let tradeCommissionAsset;
        let tradeId;
        if (bodyResponse.fills && bodyResponse.fills[0]) {
          marketprice = parseFloat(
            bodyResponse.fills[0].price ? bodyResponse.fills[0].price : 0
          );
          tradeCommission = parseFloat(
            bodyResponse.fills[0].commission
              ? bodyResponse.fills[0].commission
              : 0
          );
          tradeCommissionAsset = bodyResponse.fills[0].commissionAsset
            ? bodyResponse.fills[0].commissionAsset
            : "";
          tradeId = bodyResponse.fills[0].tradeId;
        } else {
          marketprice = 0;
          tradeCommission = 0;
          tradeCommissionAsset = "";
          tradeId = "";
        }

        let tradeSellQty = isNaN(parseFloat(bodyResponse.cummulativeQuoteQty))
          ? 0
          : parseFloat(bodyResponse.cummulativeQuoteQty);
        let finalTradeSellQty;
        if (tradeCommissionAsset == body.coinPair) {
          finalTradeSellQty = tradeSellQty - tradeCommission;
          commission = tradeCommission;
          commissionAsset = tradeCommissionAsset;
        } else {
          let binanceCommission = tradeSellQty * (0.1 / 100);
          finalTradeSellQty = tradeSellQty - binanceCommission;
          commission = binanceCommission;
          commissionAsset = body.coinPair;
        }
        let sellTradeFeesPercent = isNaN(
          parseFloat(coinDetailsDao.result.seller_fees)
        )
          ? 0
          : parseFloat(coinDetailsDao.result.seller_fees);
        let sellTradeFees = finalTradeSellQty * (sellTradeFeesPercent / 100);
        finalTradeSellQty = finalTradeSellQty - sellTradeFees;
        let tradeEntry = {};

        tradeEntry.tradeId = this.makeUniqueID(65);
        //tradeEntry.tradeId = tradeId

        tradeEntry.orderId = bodyResponse.orderId;
        tradeEntry.uid = auth.uid;
        tradeEntry.coin = coin;
        tradeEntry.baseAsset = body.coin;
        tradeEntry.quoteAsset = body.currency_id;
        tradeEntry.status = bodyResponse.status;
        tradeEntry.filledPrice = marketprice;
        tradeEntry.amount = marketprice * placeQuantity;
        tradeEntry.enteredQuantity = body.quantity;
        tradeEntry.enteredQuantityAsset = body.coin;
        tradeEntry.noOfCoins = placeQuantity;
        tradeEntry.noOfCoinsAsset = body.coin;
        tradeEntry.walletAddress = daoResult.walletId;
        tradeEntry.orderTypeId = 4;
        tradeEntry.commission = commission;
        tradeEntry.commissionAsset = commissionAsset;
        tradeEntry.tradeCommission = tradeCommission;
        tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
        tradeEntry.feePercent = sellTradeFeesPercent;
        tradeEntry.fee = sellTradeFees;
        tradeEntry.coveringTrade = 0;
        tradeEntry.limitPrice = 0;
        tradeEntry.stopPrice = 0;
        tradeEntry.transactionTime = bodyResponse.transactTime;
        tradeEntry.clientOrderId = bodyResponse.clientOrderId;
        tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
        tradeEntry.excessQuoteQty = 0;
        tradeEntry.excessQuoteAsset = "";
        tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
        //await update_wallet("sell",auth.uid,body.coinPair,marketprice * body.quantity,body.quantity,body.coin)
        let addDaoResult = await this.addTradeDao(tradeEntry);
        if (addDaoResult.error == true) {
          console.log(addDaoResult);
        }

        /** CREDITING */
        daoResult = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "AMOUNT",
          body.coinPair
        );

        openingBalance2 = daoResult;

        userBalance =
          parseFloat(daoResult.balance) + parseFloat(finalTradeSellQty);
        let credit_daoResult = await this.updateUserWalletByTypeDao(
          auth.uid,
          "AMOUNT",
          body.coinPair,
          userBalance
        );

        closingBalance2 = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "AMOUNT",
          body.coinPair
        );
        closingBalance2 = closingBalance2;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "CREDIT",
            action: "SELL",
            walletType: openingBalance2.type,
            walletTypeId: openingBalance2.typeId,
            walletId: openingBalance2.walletId,
            balance_opening: openingBalance2.balance,
            freeze_opening: openingBalance2.freeze,
            transactionAmount: parseFloat(finalTradeSellQty),
            transactionType: body.currency_id,
            balance_closing: closingBalance2.balance,
            freeze_closing: closingBalance2.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }

        response.error = false;
        response.message = "Success";
        callback(response);
      } catch (e) {
        console.log(e);
        let errorMessage;
        if (e.body) {
          errorMessage = JSON.parse(e.body);
        } else {
          errorMessage = e;
        }
        try {
          let filePath = __dirname + "/../logs/";
          let fileData = Object.assign({}, errorMessage);
          fileData.reqParams = body;
          fileData.user = auth;
          fileData.logDate = new Date().toISOString();
          fs.appendFileSync(
            filePath + "binanceTradeLogs.txt",
            JSON.stringify(fileData)
          );
        } catch (e) {
          console.log(e);
        }
        let errorTradeData = {
          uid: auth.uid,
          orderType: body.orderType,
          amount: body.quantity,
          coin: body.coin,
          coinPair: body.currency_id,
          status: "PENDING",
          errorInfo: JSON.stringify(errorMessage),
        };
        await this.insertTradeErrorDao(errorTradeData);
        response.error = true;
        response.message = errorMessage;
        callback(response);
      }
    }
    /** LIMIT BUY */
    if (body.orderType == 2) {
      /*if(auth.uid !="8KA5XznuckZyDOfXa3GpfpB2wIt1"){
        response.error = true;
        response.message = "Under development";
        callback(response);
        return
      }*/

      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }

      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "AMOUNT",
        body.currency_id
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }
      openingBalance = daoResult;

      let coin = body.coin + body.currency_id;
      let limitPrice = isNaN(parseFloat(body.limitPrice)) ? 0 : parseFloat(body.limitPrice);
      let marketPrice = 0;
      let placeQuantity = parseFloat(body.quantity)/limitPrice;
      let tradeResponse;
      try{
        /*try {
          binanceCoinPrice = await binance.prices(coin);
          if (binanceCoinPrice[coin]) {
            marketPrice = parseFloat(binanceCoinPrice[coin]);
            placeQuantity = parseFloat(body.quantity) / marketPrice;
          } else {
            response.error = true;
            response.message = "Could not get coin price";
            callback(response);
            return;
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Could not get coin price";
          callback(response);
        }*/

        let coinPairExists = 0;
        try {
          tradeFilter = await binance.exchangeInfo();
          for (let obj of tradeFilter.symbols) {
            if (coin === obj.symbol) {
              coinPairExists = 1;
              filters = { status: obj.status };
              for (let filter of obj.filters) {
                if (filter.filterType == "MIN_NOTIONAL") {
                  filters.minNotional = filter.minNotional;
                } else if (filter.filterType == "PRICE_FILTER") {
                  filters.minPrice = filter.minPrice;
                  filters.maxPrice = filter.maxPrice;
                  filters.tickSize = filter.tickSize;
                } else if (filter.filterType == "LOT_SIZE") {
                  filters.stepSize = filter.stepSize;
                  filters.minQty = filter.minQty;
                  filters.maxQty = filter.maxQty;
                }
              }
              break;
            }
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (coinPairExists == 0) {
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        //console.log("body :",params.body)
        //console.log("binanceCoinPrice :",binanceCoinPrice)
        //console.log("filter :",filters)

        if (placeQuantity < parseFloat(filters.minQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            filters.minQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (placeQuantity > parseFloat(filters.maxQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum " +
            filters.maxQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (parseFloat(body.quantity) < parseFloat(filters.minNotional) + 2) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            (parseFloat(filters.minNotional) + 2) +
            " " +
            body.currency_id;
          callback(response);
          return;
        }

        if (limitPrice < parseFloat(filters.minPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum Limit price " +
            filters.minQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        if (limitPrice > parseFloat(filters.maxPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum Limit price " +
            filters.maxQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        
        /** DEDUCTING */

        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "AMOUNT",
          body.currency_id,
          parseFloat(body.quantity) * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "AMOUNT",
          body.currency_id
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "BUY",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: parseFloat(body.quantity),
            transactionType: body.currency_id,
            balance_closing: closingBalance.balance,
            freeze_opening: closingBalance.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }


        placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);
        try{
          tradeResponse = await binance.buy(coin, placeQuantity,limitPrice);
          let bodyResponse = tradeResponse; 
          /*bodyResponse = {
            symbol: 'UNIUSDT',
            orderId: 1567602381,
            orderListId: -1,
            clientOrderId: 'Qk6IxG45Pq9MCXsOOsL9qj',
            price: '6.19000000',
            origQty: '2.07000000',
            executedQty: '0.00000000',
            cummulativeQuoteQty: '0.00000000',
            status: 'NEW',
            timeInForce: 'GTC',
            type: 'LIMIT',
            side: 'BUY',
            stopPrice: '0.00000000',
            icebergQty: '0.00000000',
            time: 1662192893737,
            updateTime: 1662192893737,
            isWorking: true,
            origQuoteOrderQty: '0.00000000'
          }    */     
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, bodyResponse);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.filters = filters;
            fileData.placeQuantity = placeQuantity;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );

          } catch (e) {
            console.log(e);
          }

        let marketprice;
        let commission=0;
        let commissionAsset="";
        let tradeCommission=0;
        let tradeCommissionAsset="";
        let excessQuoteQty=0;
        let excessQuoteAsset="";
        /*if (bodyResponse.fills && bodyResponse.fills[0]) {
          marketprice = parseFloat(
            bodyResponse.fills[0].price ? bodyResponse.fills[0].price : 0
          );
          tradeCommission = parseFloat(
            bodyResponse.fills[0].commission
              ? bodyResponse.fills[0].commission
              : 0
          );
          tradeCommissionAsset = bodyResponse.fills[0].commissionAsset
            ? bodyResponse.fills[0].commissionAsset
            : "";
          tradeId = bodyResponse.fills[0].tradeId;
        } else {
          marketprice = 0;
          tradeCommission = 0;
          tradeCommissionAsset = "";
          tradeId = "";
        }*/

        /*try {
          let cumQuotQty = bodyResponse.cummulativeQuoteQty;
          if (parseFloat(cumQuotQty) > parseFloat(body.quantity)) {
            excessQuoteQty = parseFloat(cumQuotQty) - parseFloat(body.quantity);
            if (excessQuoteQty > 0) {
              excessQuoteAsset = body.coinPair;
              let daoResult2 = await this.updateUserWalletByType2Dao(
                auth.uid,
                "AMOUNT",
                body.currency_id,
                excessQuoteQty * -1
              );
            }
          }
        } catch (er2) {
          console.log(er2);
        }*/

        /*let tradeBuyQty = isNaN(parseFloat(bodyResponse.executedQty))
          ? 0
          : parseFloat(bodyResponse.executedQty);
        let finalTradeBuyQty;
        if (tradeCommissionAsset == body.coin) {
          finalTradeBuyQty = tradeBuyQty - tradeCommission;
          commission = tradeCommission;
          commissionAsset = tradeCommissionAsset;
        } else {
          //finalTradeBuyQty = tradeBuyQty
          let binanceCommission = tradeBuyQty * (0.1 / 100);
          finalTradeBuyQty = tradeBuyQty - binanceCommission;
          commission = binanceCommission;
          commissionAsset = body.coin;
        }
        ;*/

        finalTradeBuyQty = parseFloat(body.quantity) / limitPrice
        
        let binanceCommission = finalTradeBuyQty * (0.1 / 100);
        finalTradeBuyQty = finalTradeBuyQty - binanceCommission;
        commission = binanceCommission;
        commissionAsset = body.coin;

        let buyTradeFeesPercent = isNaN(
          parseFloat(coinDetailsDao.result.buyer_fees)
        )
          ? 0
          : parseFloat(coinDetailsDao.result.buyer_fees);
        let buyTradeFees = finalTradeBuyQty * (buyTradeFeesPercent / 100);
        finalTradeBuyQty = finalTradeBuyQty - buyTradeFees
        

        let tradeEntry = {};

        tradeEntry.tradeId = this.makeUniqueID(65);
        //tradeEntry.tradeId = tradeId

        tradeEntry.orderId = bodyResponse.orderId;
        tradeEntry.uid = auth.uid;
        tradeEntry.coin = coin;
        tradeEntry.baseAsset = body.coin;
        tradeEntry.quoteAsset = body.currency_id;
        tradeEntry.status = "NEW"//bodyResponse.status;
        tradeEntry.filledPrice = limitPrice;
        tradeEntry.amount = parseFloat(body.quantity) / limitPrice;
        tradeEntry.enteredQuantity = body.quantity;
        tradeEntry.enteredQuantityAsset = body.currency_id;
        tradeEntry.noOfCoins = finalTradeBuyQty;
        tradeEntry.noOfCoinsAsset = body.coin;
        tradeEntry.walletAddress = daoResult.walletId;
        tradeEntry.orderTypeId = 2;
        tradeEntry.commission = commission;
        tradeEntry.commissionAsset = commissionAsset;
        tradeEntry.tradeCommission = tradeCommission;
        tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
        tradeEntry.feePercent = buyTradeFeesPercent;
        tradeEntry.fee = buyTradeFees;
        tradeEntry.coveringTrade = 0;
        tradeEntry.limitPrice = limitPrice;
        tradeEntry.stopPrice = 0;
        tradeEntry.transactionTime = bodyResponse.transactTime;
        tradeEntry.clientOrderId = bodyResponse.clientOrderId;
        tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
        tradeEntry.excessQuoteQty = excessQuoteQty;
        tradeEntry.excessQuoteAsset = excessQuoteAsset;
        tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
        let addDaoResult = await this.addTradeDao(tradeEntry);
        if (addDaoResult.error == true) {
          console.log(addDaoResult);
          throw new Error("Something went wrong while adding order entry")
          return
        }

        /** CREDITING */
        /*daoResult = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );

        openingBalance2 = daoResult;

        userBalance =
          parseFloat(daoResult.balance) + parseFloat(finalTradeBuyQty);
        let credit_daoResult = await this.updateUserWalletByTypeDao(
          auth.uid,
          "COIN",
          body.coin,
          userBalance
        );

        closingBalance2 = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance2 = closingBalance2;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "CREDIT",
            action: "BUY",
            walletType: openingBalance2.type,
            walletTypeId: openingBalance2.typeId,
            walletId: openingBalance2.walletId,
            balance_opening: openingBalance2.balance,
            freeze_opening: openingBalance2.freeze,
            transactionAmount: parseFloat(finalTradeBuyQty),
            transactionType: body.coin,
            balance_closing: closingBalance2.balance,
            freeze_closing: closingBalance2.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }*/

        response.error = false;
        response.message = "Success";
        callback(response);
        }catch(e){
          console.log(e);
          let errorMessage;
          if (e.body) {
            errorMessage = JSON.parse(e.body);
          } else {
            errorMessage = e;
          }
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, errorMessage);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );
          } catch (er) {
              console.log(er);
          }
          let errorTradeData = {
            uid: auth.uid,
            orderType: body.orderType,
            amount: body.quantity,
            coin: body.coin,
            coinPair: body.currency_id,
            status: "PENDING",
            errorInfo: JSON.stringify(errorMessage),
          };
          await this.insertTradeErrorDao(errorTradeData);
          response.error = true;
          response.message = errorMessage;
          callback(response);
        }
      }catch(e){
        console.log(e)
        response.error = true;
        response.errorMessage = e;
        callback(response);
      }
    } else if (body.orderType == 5) {
      /** LIMIT SELL */
      /*if(auth.uid !="8KA5XznuckZyDOfXa3GpfpB2wIt1"){
        response.error = true;
        response.message = "Under development";
        callback(response);
        return
      }*/

      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }

      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "COIN",
        body.coin
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }
      openingBalance = daoResult;

      let coin = body.coin + body.currency_id;
      let limitPrice = isNaN(parseFloat(body.limitPrice)) ? 0 : parseFloat(body.limitPrice);
      let marketPrice = 0;
      let placeQuantity = parseFloat(body.quantity);
      let tradeResponse;
      try{
        /*try {
          binanceCoinPrice = await binance.prices(coin);
          if (binanceCoinPrice[coin]) {
            marketPrice = parseFloat(binanceCoinPrice[coin]);
            placeQuantity = parseFloat(body.quantity) / marketPrice;
          } else {
            response.error = true;
            response.message = "Could not get coin price";
            callback(response);
            return;
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Could not get coin price";
          callback(response);
        }*/

        let coinPairExists = 0;
        try {
          tradeFilter = await binance.exchangeInfo();
          for (let obj of tradeFilter.symbols) {
            if (coin === obj.symbol) {
              coinPairExists = 1;
              filters = { status: obj.status };
              for (let filter of obj.filters) {
                if (filter.filterType == "MIN_NOTIONAL") {
                  filters.minNotional = filter.minNotional;
                } else if (filter.filterType == "PRICE_FILTER") {
                  filters.minPrice = filter.minPrice;
                  filters.maxPrice = filter.maxPrice;
                  filters.tickSize = filter.tickSize;
                } else if (filter.filterType == "LOT_SIZE") {
                  filters.stepSize = filter.stepSize;
                  filters.minQty = filter.minQty;
                  filters.maxQty = filter.maxQty;
                }
              }
              break;
            }
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (coinPairExists == 0) {
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        //console.log("body :",params.body)
        //console.log("binanceCoinPrice :",binanceCoinPrice)
        //console.log("filter :",filters)

        if (placeQuantity < parseFloat(filters.minQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            filters.minQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (placeQuantity > parseFloat(filters.maxQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum " +
            filters.maxQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (parseFloat(body.quantity) < parseFloat(filters.minNotional) + 2) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            (parseFloat(filters.minNotional) + 2) +
            " " +
            body.currency_id;
          callback(response);
          return;
        }

        if (limitPrice < parseFloat(filters.minPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum Limit price " +
            filters.minQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        if (limitPrice > parseFloat(filters.maxPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum Limit price " +
            filters.maxQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        
        placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);

        /** DEDUCTING */

        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "COIN",
          body.coin,
          placeQuantity * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "BUY",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: parseFloat(body.quantity),
            transactionType: body.currency_id,
            balance_closing: closingBalance.balance,
            freeze_opening: closingBalance.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }

        try{
          tradeResponse = await binance.sell(coin, placeQuantity,limitPrice);
          let bodyResponse = tradeResponse; 
          /*bodyResponse = {
            symbol: 'UNIUSDT',
            orderId: 1567602381,
            orderListId: -1,
            clientOrderId: 'Qk6IxG45Pq9MCXsOOsL9qj',
            price: '6.19000000',
            origQty: '2.07000000',
            executedQty: '0.00000000',
            cummulativeQuoteQty: '0.00000000',
            status: 'NEW',
            timeInForce: 'GTC',
            type: 'LIMIT',
            side: 'BUY',
            stopPrice: '0.00000000',
            icebergQty: '0.00000000',
            time: 1662192893737,
            updateTime: 1662192893737,
            isWorking: true,
            origQuoteOrderQty: '0.00000000'
          }    */     
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, bodyResponse);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.filters = filters;
            fileData.placeQuantity = placeQuantity;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );

          } catch (e) {
            console.log(e);
          }

        let marketprice;
        let commission=0;
        let commissionAsset="";
        let tradeCommission=0;
        let tradeCommissionAsset="";
        let excessQuoteQty=0;
        let excessQuoteAsset="";

        let finalTradeSellQty = parseFloat(body.quantity)
        
        let binanceCommission = finalTradeSellQty * (0.1 / 100);
        finalTradeSellQty = finalTradeSellQty - binanceCommission;
        commission = binanceCommission;
        commissionAsset = body.currency_id;

        let sellTradeFeesPercent = isNaN(
          parseFloat(coinDetailsDao.result.seller_fees)
        )
          ? 0
          : parseFloat(coinDetailsDao.result.buyer_fees);
        let sellTradeFees = finalTradeSellQty * (sellTradeFeesPercent / 100);
        finalTradeSellQty = finalTradeSellQty - sellTradeFees

        let tradeEntry = {};

        tradeEntry.tradeId = this.makeUniqueID(65);
        //tradeEntry.tradeId = tradeId

        tradeEntry.orderId = bodyResponse.orderId;
        tradeEntry.uid = auth.uid;
        tradeEntry.coin = coin;
        tradeEntry.baseAsset = body.coin;
        tradeEntry.quoteAsset = body.currency_id;
        tradeEntry.status = "NEW"//bodyResponse.status;
        tradeEntry.filledPrice = limitPrice;
        tradeEntry.amount = placeQuantity * limitPrice;
        tradeEntry.enteredQuantity = placeQuantity;
        tradeEntry.enteredQuantityAsset = body.coin;
        tradeEntry.noOfCoins = parseFloat(body.quantity);
        tradeEntry.noOfCoinsAsset = body.coin;
        tradeEntry.walletAddress = daoResult.walletId;
        tradeEntry.orderTypeId = 5;
        tradeEntry.commission = commission;
        tradeEntry.commissionAsset = body.currency_id;
        tradeEntry.tradeCommission = tradeCommission;
        tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
        tradeEntry.feePercent = sellTradeFeesPercent;
        tradeEntry.fee = sellTradeFees;
        tradeEntry.coveringTrade = 0;
        tradeEntry.limitPrice = limitPrice;
        tradeEntry.stopPrice = 0;
        tradeEntry.transactionTime = bodyResponse.transactTime;
        tradeEntry.clientOrderId = bodyResponse.clientOrderId;
        tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
        tradeEntry.excessQuoteQty = excessQuoteQty;
        tradeEntry.excessQuoteAsset = excessQuoteAsset;
        tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
        let addDaoResult = await this.addTradeDao(tradeEntry);
        if (addDaoResult.error == true) {
          console.log(addDaoResult);
          throw new Error("Something went wrong while adding order entry")
          return
        }

        /** CREDITING */
        /*daoResult = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );

        openingBalance2 = daoResult;

        userBalance =
          parseFloat(daoResult.balance) + parseFloat(finalTradeBuyQty);
        let credit_daoResult = await this.updateUserWalletByTypeDao(
          auth.uid,
          "COIN",
          body.coin,
          userBalance
        );

        closingBalance2 = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance2 = closingBalance2;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "CREDIT",
            action: "BUY",
            walletType: openingBalance2.type,
            walletTypeId: openingBalance2.typeId,
            walletId: openingBalance2.walletId,
            balance_opening: openingBalance2.balance,
            freeze_opening: openingBalance2.freeze,
            transactionAmount: parseFloat(finalTradeBuyQty),
            transactionType: body.coin,
            balance_closing: closingBalance2.balance,
            freeze_closing: closingBalance2.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }*/

        response.error = false;
        response.message = "Success";
        callback(response);
        }catch(e){
          console.log(e);
          let errorMessage;
          if (e.body) {
            errorMessage = JSON.parse(e.body);
          } else {
            errorMessage = e;
          }
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, errorMessage);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );
          } catch (er) {
              console.log(er);
          }
          let errorTradeData = {
            uid: auth.uid,
            orderType: body.orderType,
            amount: body.quantity,
            coin: body.coin,
            coinPair: body.currency_id,
            status: "PENDING",
            errorInfo: JSON.stringify(errorMessage),
          };
          await this.insertTradeErrorDao(errorTradeData);
          response.error = true;
          response.message = errorMessage;
          callback(response);
        }
      }catch(e){
        console.log(e)
        response.error = true;
        response.errorMessage = e;
        callback(response);
      }
    }
    /** STOP LIMIT BUY*/
    if (body.orderType == 3) {
      /*if(auth.uid !="8KA5XznuckZyDOfXa3GpfpB2wIt1"){
        response.error = true;
        response.message = "Under development";
        callback(response);
        return
      }*/

      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }
      
      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "AMOUNT",
        body.currency_id
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }
      openingBalance = daoResult;

      let coin = body.coin + body.currency_id;
      let limitPrice = isNaN(parseFloat(body.limitPrice)) ? 0 : parseFloat(body.limitPrice);
      let marketPrice = 0;
      let placeQuantity = parseFloat(body.quantity)/limitPrice;
      let tradeResponse;
      try{
        
        let coinPairExists = 0;
        try {
          tradeFilter = await binance.exchangeInfo();
          for (let obj of tradeFilter.symbols) {
            if (coin === obj.symbol) {
              coinPairExists = 1;
              filters = { status: obj.status };
              for (let filter of obj.filters) {
                if (filter.filterType == "MIN_NOTIONAL") {
                  filters.minNotional = filter.minNotional;
                } else if (filter.filterType == "PRICE_FILTER") {
                  filters.minPrice = filter.minPrice;
                  filters.maxPrice = filter.maxPrice;
                  filters.tickSize = filter.tickSize;
                } else if (filter.filterType == "LOT_SIZE") {
                  filters.stepSize = filter.stepSize;
                  filters.minQty = filter.minQty;
                  filters.maxQty = filter.maxQty;
                }
              }
              break;
            }
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (coinPairExists == 0) {
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        /** STEP SIZE */
        placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);

        if (placeQuantity < parseFloat(filters.minQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            filters.minQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (placeQuantity > parseFloat(filters.maxQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum " +
            filters.maxQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (parseFloat(body.quantity) < parseFloat(filters.minNotional) + 2) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            (parseFloat(filters.minNotional) + 2) +
            " " +
            body.currency_id;
          callback(response);
          return;
        }

        if (limitPrice < parseFloat(filters.minPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum Limit price " +
            filters.minQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        if (limitPrice > parseFloat(filters.maxPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum Limit price " +
            filters.maxQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }

        /** DEDUCTING */

        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "AMOUNT",
          body.currency_id,
          parseFloat(body.quantity) * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "AMOUNT",
          body.currency_id
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "BUY",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: parseFloat(body.quantity),
            transactionType: body.currency_id,
            balance_closing: closingBalance.balance,
            freeze_opening: closingBalance.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }

        try{
          tradeResponse = await binance.buy(
            coin,
            placeQuantity,
            body.limitPrice,
            { type: "STOP_LOSS_LIMIT", stopPrice: body.stopPrice }
          );
          let bodyResponse = tradeResponse; 
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, bodyResponse);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.filters = filters;
            fileData.placeQuantity = placeQuantity;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );

          } catch (e) {
            console.log(e);
          }
          

          let marketprice;
          let commission=0;
          let commissionAsset="";
          let tradeCommission=0;
          let tradeCommissionAsset="";
          let excessQuoteQty=0;
          let excessQuoteAsset="";

          finalTradeBuyQty = parseFloat(body.quantity) / limitPrice

          let buyTradeFeesPercent = isNaN(
            parseFloat(coinDetailsDao.result.buyer_fees)
          )
            ? 0
            : parseFloat(coinDetailsDao.result.buyer_fees);
          let buyTradeFees = finalTradeBuyQty * (buyTradeFeesPercent / 100);
          finalTradeBuyQty = finalTradeBuyQty - buyTradeFees
  
          let tradeEntry = {};
  
          tradeEntry.tradeId = this.makeUniqueID(65);
          //tradeEntry.tradeId = tradeId
  
          tradeEntry.orderId = bodyResponse.orderId;
          tradeEntry.uid = auth.uid;
          tradeEntry.coin = coin;
          tradeEntry.baseAsset = body.coin;
          tradeEntry.quoteAsset = body.currency_id;
          tradeEntry.status = "NEW"//bodyResponse.status ? body.status : "NEW";
          tradeEntry.filledPrice = limitPrice;
          tradeEntry.amount = parseFloat(body.quantity) / limitPrice;
          tradeEntry.enteredQuantity = body.quantity;
          tradeEntry.enteredQuantityAsset = body.currency_id;
          tradeEntry.noOfCoins = finalTradeBuyQty;
          tradeEntry.noOfCoinsAsset = body.coin;
          tradeEntry.walletAddress = daoResult.walletId;
          tradeEntry.orderTypeId = 3;
          tradeEntry.commission = commission;
          tradeEntry.commissionAsset = commissionAsset;
          tradeEntry.tradeCommission = tradeCommission;
          tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
          tradeEntry.feePercent = buyTradeFeesPercent;
          tradeEntry.fee = buyTradeFees;
          tradeEntry.coveringTrade = 0;
          tradeEntry.limitPrice = limitPrice;
          tradeEntry.stopPrice = body.stopPrice;
          tradeEntry.transactionTime = bodyResponse.transactTime;
          tradeEntry.clientOrderId = bodyResponse.clientOrderId;
          tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
          tradeEntry.excessQuoteQty = excessQuoteQty;
          tradeEntry.excessQuoteAsset = excessQuoteAsset;
          tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
          let addDaoResult = await this.addTradeDao(tradeEntry);
          if (addDaoResult.error == true) {
            console.log(addDaoResult);
            throw new Error("Something went wrong while adding order entry")
            return
          }

          response.error = false;
          response.message = "Success";
          callback(response);

        }catch(e){
          console.log(e);
          let errorMessage;
          if (e.body) {
            errorMessage = JSON.parse(e.body);
          } else {
            errorMessage = e;
          }
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, errorMessage);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );
          } catch (er) {
              console.log(er);
          }
          let errorTradeData = {
            uid: auth.uid,
            orderType: body.orderType,
            amount: body.quantity,
            coin: body.coin,
            coinPair: body.currency_id,
            status: "PENDING",
            errorInfo: JSON.stringify(errorMessage),
          };
          await this.insertTradeErrorDao(errorTradeData);
          response.error = true;
          response.message = errorMessage;
          callback(response);
        }
      }catch(e){
        console.log(e)
        response.error = true;
        response.errorMessage = e;
        callback(response);
      }
    } else if (body.orderType == 6) {
      /** STOP LIMIT SELL*/

      /*if(auth.uid !="8KA5XznuckZyDOfXa3GpfpB2wIt1"){
        response.error = true;
        response.message = "Under development";
        callback(response);
        return
      }*/

      /** VALIDATING COIN */
      let coinDetailsDao = await this.getCoinDetailsByCoinDao(
        body.coin,
        body.currency_id
      );
      if (coinDetailsDao.error) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      } else if (coinDetailsDao.result == undefined) {
        response.error = true;
        response.message = "Not a valid coin";
        callback(response);
        return;
      }

      /** VALIDATING USER COIN BALANCE */
      let daoResult = await this.getUserWalletByType_TradeDao(
        auth.uid,
        "COIN",
        body.coin
      );
      if (!daoResult || daoResult == undefined) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      } else if (
        daoResult.balance == undefined ||
        daoResult.balance == 0 ||
        daoResult.balance < parseFloat(body.quantity)
      ) {
        response.error = true;
        response.message = "User does not have sufficient balance";
        callback(response);
        return;
      }
      openingBalance = daoResult;

      let coin = body.coin + body.currency_id;
      let limitPrice = isNaN(parseFloat(body.limitPrice)) ? 0 : parseFloat(body.limitPrice);
      let marketPrice = 0;
      let placeQuantity = parseFloat(body.quantity);
      let tradeResponse;
      try{
        /*try {
          binanceCoinPrice = await binance.prices(coin);
          if (binanceCoinPrice[coin]) {
            marketPrice = parseFloat(binanceCoinPrice[coin]);
            placeQuantity = parseFloat(body.quantity) / marketPrice;
          } else {
            response.error = true;
            response.message = "Could not get coin price";
            callback(response);
            return;
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Could not get coin price";
          callback(response);
        }*/

        let coinPairExists = 0;
        try {
          tradeFilter = await binance.exchangeInfo();
          for (let obj of tradeFilter.symbols) {
            if (coin === obj.symbol) {
              coinPairExists = 1;
              filters = { status: obj.status };
              for (let filter of obj.filters) {
                if (filter.filterType == "MIN_NOTIONAL") {
                  filters.minNotional = filter.minNotional;
                } else if (filter.filterType == "PRICE_FILTER") {
                  filters.minPrice = filter.minPrice;
                  filters.maxPrice = filter.maxPrice;
                  filters.tickSize = filter.tickSize;
                } else if (filter.filterType == "LOT_SIZE") {
                  filters.stepSize = filter.stepSize;
                  filters.minQty = filter.minQty;
                  filters.maxQty = filter.maxQty;
                }
              }
              break;
            }
          }
        } catch (e) {
          console.log(e);
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        if (coinPairExists == 0) {
          response.error = true;
          response.message = "Provide a valid coin pair";
          callback(response);
        }

        //console.log("body :",params.body)
        //console.log("binanceCoinPrice :",binanceCoinPrice)
        //console.log("filter :",filters)

        if (placeQuantity < parseFloat(filters.minQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            filters.minQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (placeQuantity > parseFloat(filters.maxQty)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum " +
            filters.maxQty +
            " " +
            body.coin;
          callback(response);
          return;
        }
        if (parseFloat(body.quantity) < parseFloat(filters.minNotional) + 2) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum " +
            (parseFloat(filters.minNotional) + 2) +
            " " +
            body.currency_id;
          callback(response);
          return;
        }

        if (limitPrice < parseFloat(filters.minPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Minimum Limit price " +
            filters.minQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        if (limitPrice > parseFloat(filters.maxPrice)) {
          response.error = true;
          response.message =
            "Trade can only be executed with Maximum Limit price " +
            filters.maxQty +
            " " +
            body.coin+body.currency_id;
          callback(response);
          return;
        }
        
        /** DEDUCTING */

        let deduct_daoResult = await this.updateUserWalletByType2Dao(
          auth.uid,
          "COIN",
          body.coin,
          parseFloat(body.quantity) * -1
        );

        closingBalance = await this.getUserWalletByType_TradeDao(
          auth.uid,
          "COIN",
          body.coin
        );
        closingBalance = closingBalance;

        try {
          let actionLogData = {
            uid: auth.uid,
            type: "DEBIT",
            action: "BUY",
            walletType: openingBalance.type,
            walletTypeId: openingBalance.typeId,
            walletId: openingBalance.walletId,
            balance_opening: openingBalance.balance,
            freeze_opening: openingBalance.freeze,
            transactionAmount: parseFloat(body.quantity),
            transactionType: body.currency_id,
            balance_closing: closingBalance.balance,
            freeze_opening: closingBalance.freeze,
          };
          await this.insertUserActionLogsDao(actionLogData);
        } catch (e) {
          console.log(e);
        }


        placeQuantity = binance.roundStep(placeQuantity, filters.stepSize);
        try{
          tradeResponse = await binance.sell(coin, placeQuantity,limitPrice);
          tradeResponse = await binance.sell(
            coin,
            placeQuantity,
            body.limitPrice,
            { type: "STOP_LOSS_LIMIT", stopPrice: body.stopPrice }
          );
          let bodyResponse = tradeResponse;   
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, bodyResponse);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.filters = filters;
            fileData.placeQuantity = placeQuantity;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );

          } catch (e) {
            console.log(e);
          }

        let marketprice;
        let commission=0;
        let commissionAsset="";
        let tradeCommission=0;
        let tradeCommissionAsset="";
        let excessQuoteQty=0;
        let excessQuoteAsset="";

        let finalTradeSellQty = parseFloat(body.quantity)

        let sellTradeFeesPercent = isNaN(
          parseFloat(coinDetailsDao.result.seller_fees)
        )
          ? 0
          : parseFloat(coinDetailsDao.result.buyer_fees);
        let sellTradeFees = finalTradeSellQty * (sellTradeFeesPercent / 100);
        finalTradeSellQty = finalTradeSellQty - sellTradeFees

        let tradeEntry = {};

        tradeEntry.tradeId = this.makeUniqueID(65);
        //tradeEntry.tradeId = tradeId

        tradeEntry.orderId = bodyResponse.orderId;
        tradeEntry.uid = auth.uid;
        tradeEntry.coin = coin;
        tradeEntry.baseAsset = body.coin;
        tradeEntry.quoteAsset = body.currency_id;
        tradeEntry.status = "NEW"//tradeEntry.status = bodyResponse.status ? body.status : "NEW";
        tradeEntry.filledPrice = limitPrice;
        tradeEntry.amount = placeQuantity * limitPrice;
        tradeEntry.enteredQuantity = body.quantity;
        tradeEntry.enteredQuantityAsset = body.coin;
        tradeEntry.noOfCoins = parseFloat(body.quantity);
        tradeEntry.noOfCoinsAsset = body.coin;
        tradeEntry.walletAddress = daoResult.walletId;
        tradeEntry.orderTypeId = 6;
        tradeEntry.commission = commission;
        tradeEntry.commissionAsset = commissionAsset;
        tradeEntry.tradeCommission = tradeCommission;
        tradeEntry.tradeCommissionAsset = tradeCommissionAsset;
        tradeEntry.feePercent = sellTradeFeesPercent;
        tradeEntry.fee = sellTradeFees;
        tradeEntry.coveringTrade = 0;
        tradeEntry.limitPrice = limitPrice;
        tradeEntry.stopPrice = body.stopPrice;
        tradeEntry.transactionTime = bodyResponse.transactTime;
        tradeEntry.clientOrderId = bodyResponse.clientOrderId;
        tradeEntry.cummulativeQuoteQty = bodyResponse.cummulativeQuoteQty;
        tradeEntry.excessQuoteQty = excessQuoteQty;
        tradeEntry.excessQuoteAsset = excessQuoteAsset;
        tradeEntry.additionalTradeInfo = JSON.stringify(bodyResponse);
        let addDaoResult = await this.addTradeDao(tradeEntry);
        if (addDaoResult.error == true) {
          console.log(addDaoResult);
          throw new Error("Something went wrong while adding order entry")
          return
        }

        response.error = false;
        response.message = "Success";
        callback(response);
        }catch(e){
          console.log(e);
          let errorMessage;
          if (e.body) {
            errorMessage = JSON.parse(e.body);
          } else {
            errorMessage = e;
          }
          try {
            let filePath = __dirname + "/../logs/";
            let fileData = Object.assign({}, errorMessage);
            fileData.reqParams = body;
            fileData.user = auth;
            fileData.filters = filters;
            fileData.placeQuantity = placeQuantity;
            fileData.logDate = new Date().toISOString();
            fs.appendFileSync(
              filePath + "binanceTradeLogs.txt",
              JSON.stringify(fileData)
            );
          } catch (er) {
              console.log(er);
          }
          let errorTradeData = {
            uid: auth.uid,
            orderType: body.orderType,
            amount: body.quantity,
            coin: body.coin,
            coinPair: body.currency_id,
            status: "PENDING",
            errorInfo: JSON.stringify(errorMessage),
          };
          await this.insertTradeErrorDao(errorTradeData);
          response.error = true;
          response.message = errorMessage;
          callback(response);
        }
      }catch(e){
        console.log(e)
        response.error = true;
        response.errorMessage = e;
        callback(response);
      }
  };
}

  /** TRADE WALLET UPDATE */
  async function user_update_wallet_trade(
    orderType,
    uid,
    coinPair,
    amount,
    coins,
    coinId
  ) {
    if (orderType == "buy") {
      /** DEDUCTING */
      let daoResult = await this.getUserWalletByType_TradeDao(
        uid,
        "COIN",
        coinPair
      );
      let userBalance = daoResult.balance - amount;
      daoResult = await this.updateUserWalletByTypeDao(
        db,
        uid,
        "COIN",
        coinPair,
        userBalance
      );
      /** CREDITING */
      daoResult = await this.getUserWalletByType_TradeDao(uid, "COIN", coinId);
      userBalance = daoResult.balance + coins;
      daoResult = await this.updateUserWalletByTypeDao(
        db,
        uid,
        "COIN",
        coinId,
        userBalance
      );
    }
    if (orderType == "sell") {
      /** ADDING AMOUNT */
      let daoResult = await this.getUserWalletByType_TradeDao(
        uid,
        "AMOUNT",
        coinPair
      );
      let userBalance = daoResult.balance + amount;
      daoResult = await this.updateUserWalletByTypeDao(
        uid,
        "AMOUNT",
        coinPair,
        userBalance
      );
      /** DEDUCTION COINS */
      daoResult = await this.getUserWalletByType_TradeDao(uid, "COIN", coinId);
      userBalance = daoResult.balance - coins;
      daoResult = await this.updateUserWalletByTypeDao(
        uid,
        "COIN",
        coinId,
        userBalance
      );
    }
    if (orderType == "p2pbuy") {
      /** ADDING COINS */
      let daoResult = await this.getUserWalletByType_TradeDao(
        uid,
        "COIN",
        coinId
      );
      let userBalance = daoResult.balance + coins;
      daoResult = await this.updateUserWalletByTypeDao(
        uid,
        "COIN",
        coinId,
        userBalance
      );
    }
    if (orderType == "p2psell") {
      let daoResult = await this.getUserWalletByType_TradeDao(
        uid,
        "COIN",
        coinId
      );
      let userBalance = daoResult.balance - coins;
      daoResult = await this.updateUserWalletByTypeDao(
        uid,
        "COIN",
        coinId,
        userBalance
      );
    }
  }

  this.getRecentTradesService = async (params, callback) => {
    var response = {};
    let body = params.body;
    let auth = params.params.auth;
    let tradeDaoResults = await this.getRecentTradesDao(
      body.coin === "all"
        ? { uid: auth.uid }
        : {
            uid: auth.uid,
            coin: body.coin,
          }
    );
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

  this.getAllTradesService = async (params, callback) => {
    var response = {};
    let body = params.body;
    let auth = params.params.auth;
    let userTrades = await this.getUserTradesDao({ uid: auth.uid });
    userTrades = userTrades.result;
    /*binance.allOrders(body.coin, (error, orders, symbol) => {
      if (error) {
        response.error = true;
        response.message = error.body;
        response.errorCode = "1";
      } else {
        response.error = false;
        response.message = "Success";
        response.errorCode = "0";
        let orderIds_ = userTrades.map((row) => parseInt(row.orderId));
        response.allOrders = orders.filter(
          (row) => orderIds_.indexOf(row.orderId) > -1
        );
      }
      console.log(error, orders);
      callback(response);
    });*/
    response.error = false;
    response.message = "Success";
    response.allOrders = userTrades
    response.errorCode = "0";
    callback(response);
  };

  this.cancelOrderService = async (params, callback) => {
    var response = {};
    let body = params.body;
    let auth = params.params.auth;
    let tradeOrderDetails = await this.getTradeDetailsDao({ orderId: body.orderid });
    if (tradeOrderDetails.error == false) {
      binance.cancel(body.coin, body.orderid, (error, Bresponse, symbol) => {
        if (error) {
          console.log(error)
          response.error = true;
          response.message = "Unable to cancel the order at this time";
          response.errorCode = "0";s
        } else {
          console.log(Bresponse.body)
          response.error = false;
          response.message = "Your order cancel request has been placed.";
          response.errorCode = "0";
        }
        callback(response);
      });
    } else {
      response.error = true;
      response.message = "Invalid order id";
      response.errorCode = "0";
      callback(response)
    }
  };

  this.getTradeFiltersService = async (callback) => {
    let coinPairs = await this.getCoinsDao();
    if (coinPairs.error == false) {
      coinPairs = coinPairs.result;
      let result = coinPairs.map((coins) => coins.coin + coins.coinPair);
      coinPairs = result;
    } else {
      coinPairs = [];
    }
    binance.exchangeInfo(function (error, data) {
      if (error) {
        response.error = true;
        response.message = error;
        response.errorCode = "0";
      } else {
        let minimums = {};
        for (let obj of data.symbols) {
          if (coinPairs.indexOf(obj.symbol) > -1) {
            let filters = { status: obj.status };
            for (let filter of obj.filters) {
              if (filter.filterType == "MIN_NOTIONAL") {
                filters.minNotional = filter.minNotional;
              } else if (filter.filterType == "PRICE_FILTER") {
                filters.minPrice = filter.minPrice;
                filters.maxPrice = filter.maxPrice;
                filters.tickSize = filter.tickSize;
              } else if (filter.filterType == "LOT_SIZE") {
                filters.stepSize = filter.stepSize;
                filters.minQty = filter.minQty;
                filters.maxQty = filter.maxQty;
              }
            }
            //filters.baseAssetPrecision = obj.baseAssetPrecision;
            //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
            filters.orderTypes = obj.orderTypes;
            filters.icebergAllowed = obj.icebergAllowed;
            minimums[obj.symbol] = filters;
          }
        }
        response.minimums = minimums;
      }
      callback(response);
    });
  };

  this.getAxiosRespService = async (body, callback) => {
    var response = {};
    try{
    const axios = require("axios");
    let axiosResult;
    if(body.type.toUpperCase() == "GET"){
      axiosResult =await axios.get(body.url)
    }else if(body.type.toUpperCase() == "POST"){
      axiosResult =await axios.post(body.url,body.body)
    }
    //console.log(response)
    response = axiosResult.data
    callback(response)
   }catch(e){
    callback(e)
   }
  };
};
