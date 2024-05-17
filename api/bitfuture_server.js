var express = require("express");
var https = require("https");
var app = express();
var http = require("http").Server(app);
const bodyParser = require("body-parser");
var jwt = require("express-jwt");
const BinanceNode = require("node-binance-api");
require("dotenv").config();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(bodyParser.raw({limit:'50mb',type: 'multipart/form-data'}))
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Orgin, X-Requested-With, Content-Type,Accept,Authorization"
  );
  next();
});

// Binance initialization
const binance = new BinanceNode().options({
  APIKEY: process.env.BINANCE_APIKEY,
  APISECRET: process.env.BINANCE_SECRET_KEY,
  // test: true,
  // urls: {
  //   base: process.env.BINANCE_BASE_URL, // testnet endpoint or default
  // },
});

/** Authorization */

async function auth(request, response, next) {
  var error = {};
  try {
    var auth = await this.getDataFromToken(
      request.headers.authorization,
      process.env.JWT_SECRET
    );
    if (auth.error) {
      error.error = true;
      error.msg = "Unauthorized";
      return response.send(error);
    } else {
      request.params.auth = auth.data;
    }
  } catch (e) {
    error.error = true;
    error.msg = "Unauthorized";
    return response.send(error);
  }
  next();
}

async function auth_admin(request, response, next) {
  var error = {};
  try {
    var auth = await this.getDataFromToken(
      request.headers.authorization,
      process.env.JWT_SECRET
    );
    if (auth.error) {
      error.error = true;
      error.msg = "Unauthorized";
      return response.send(error);
    } else {
      let authData = auth.data;
      if (authData.admin && authData.admin == true) {
        request.params.auth = authData;
      } else {
        error.error = true;
        error.msg = "Unauthorized";
        return response.send(error);
      }
    }
  } catch (e) {
    error.error = true;
    error.msg = "Unauthorized";
    return response.send(error);
  }
  next();
}

app.user_auth = auth;
app.admin_auth = auth_admin;
app.db = require("./config/db.js");
app.binance = binance;
require("./config/firebase.js");

var coinBaseClient = require("coinbase").Client;
var coinBase = new coinBaseClient({
  apiKey: process.env.COINBASE_APIKEY,
  apiSecret: process.env.COINBASE_APISECRET,
  strictSSL: false,
});
app.coinBase = coinBase;

/** ROUTES */

require("./routes/user")(app);
require("./routes/trade")(app);
require("./routes/admin")(app);
/** STARTING SERVER */

var server = http.listen(process.env.NODE_PORT, "0.0.0.0", () => {
  console.log("Server is running on port", server.address().port);
});
