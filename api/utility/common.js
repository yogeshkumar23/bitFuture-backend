module.exports = function () {
  var jwt = require("jsonwebtoken");
  var nodemailer = require("nodemailer");
  var bcrypt = require("bcrypt-nodejs");
   
  this.returnMailContent = function (data){
    return `<!DOCTYPE html>

  <html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
  
  <head>
  
    <meta charset="utf-8">
  
    <meta name="viewport" content="width=device-width,initial-scale=1">
  
    <meta name="x-apple-disable-message-reformatting">
  
    <title></title>
  
    <!--[if mso]>
  
    <style>
  
      table {border-collapse:collapse;border-spacing:0;border:none;margin:0;}
  
      div, td {padding:0;}
  
      div {margin:0 !important;}
  
    </style>
  
    <noscript>
  
      <xml>
  
        <o:OfficeDocumentSettings>
  
          <o:PixelsPerInch>96</o:PixelsPerInch>
  
        </o:OfficeDocumentSettings>
  
      </xml>
  
    </noscript>
  
    <![endif]-->
  
    <style>
  
      table, td, div, h1, p {
  
        font-family: inter;
  
      }
  
      a .social_media_icons{
  
        height: 30px;
  
        padding:5px;
  
      }
  
      @media screen and (max-width: 530px) {
  
        .unsub {
  
          display: block;
  
          padding: 8px;
  
          margin-top: 14px;
  
          border-radius: 6px;
  
          background-color: #555555;
  
          text-decoration: none !important;
  
          font-weight: bold;
  
        }
  
        .col-lge {
  
          max-width: 100% !important;
  
        }
  
      }
  
      @media screen and (min-width: 531px) {
  
        .col-sml {
  
          max-width: 27% !important;
  
        }
  
        .col-lge {
  
          max-width: 73% !important;
  
        }
  
      }
  
    </style>
  
  </head>
  
  <body style="margin:0;padding:0;word-spacing:normal;background-image:url(http://159.223.163.191/assets/Background/right_bg.png);background-repeat:no-repeat;background-position:center;background-size: auto 100%;">
  
    <div role="article" aria-roledescription="email" lang="en" style="text-size-adjust:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  
      <table role="presentation" style="width:100%;border:none;border-spacing:0;">
  
        <tr>
  
          <td align="center" style="padding:0;">
  
            <!--[if mso]>
  
            <table role="presentation" align="center" style="width:600px;">
  
            <tr>
  
            <td>
  
            <![endif]-->
  
            <table role="presentation" style="width:94%;max-width:600px;border:none;border-spacing:0;text-align:left;font-family:Arial,sans-serif;font-size:16px;line-height:22px;color:#363636;">
  
              <tr>
  
                <td style="padding:40px 30px 30px 30px;text-align:center;font-size:24px;font-weight:bold;">
  
                  <a href="http://www.example.com/" style="text-decoration:none;"><img src="http://159.223.163.191/assets/Logos/logowhite.png" width="165" alt="Logo" style="width:165px;max-width:80%;height:auto;border:none;text-decoration:none;color:#ffffff;"></a>
  
                </td>
  
              </tr>
  
              <tr>
  
                <td style="padding:30px;background-color:#ffffff;">
  
                  <h1 style="margin-top:0;margin-bottom:16px;font-size:26px;line-height:32px;font-weight:bold;letter-spacing:-0.02em;">${data.title}</h1>
  
                  <p style="margin:0;">PYRA CENTER provides you with an incredible gateway to the Gains of a digital assets universe that is valued at over $3Trillion as of today. You can Send, Receive, and Exchange Assets in a simple, smart and secure way. We can show you more...</p>
  
                </td>
  
              </tr>
  
              <tr>
  
                <td style="padding:35px 30px 11px 30px;font-size:0;background-color:#ffffff;border-bottom:1px solid #f0f0f5;border-color:rgba(201,201,207,.35);">
  
                    <p style="margin:0;"><a href="${data.buttonLink == "OTP" ? "":data.buttonLink}" style="
  
            background-color: #2566c3;
  
            padding: 10px;
  
            border: none;
  
            border-radius: 5px;
  
            font-size: 16px;
  
            font-weight: 500;
  
            color: #fff;

            ${data.buttonLink != "OTP" ?"cursor:pointer;": "letter-spacing:1em" }
  
          ">
  
              ${data.buttonName}
  
          </a></p>
  
                </td>
  
              </tr>

              <tr>

              <td style="padding:10px 30px 30px 30px;background-color:#ffffff;border-color:rgba(201,201,207,.35);">

                <p style="margin:0;">${data.message}</p>

               </td>

              </tr>
  
              <tr>
  
                <td style="padding:5px;font-size:24px;line-height:28px;font-weight:bold;background-color:#ffffff;border-bottom:1px solid #f0f0f5;border-color:rgba(201,201,207,.35);">
  
                  <a href="http://159.223.163.191:8783" style="text-decoration:none;"><img src="http://159.223.163.191/assets/mail/images/svg_1.png" width="540" alt="" style="width:100%;height:auto;border:none;text-decoration:none;color:#363636;"></a>
  
                </td>
  
              </tr>

              <tr>
  
                <td style="padding:30px;background-color:#ffffff;">
  
                  <p><strong>Kindly note:</strong>
  
                  Please be aware of phishing sites and always make sure you are visiting the official pyracenter
  
                  website when entering sensitive data.
  
              </p>
  
                </td>
  
              </tr>
  
              <tr>
  
                <td style="padding:30px;background-color:#fff;color:#cccccc;">
  
                  <div style="display: flex;justify-content: center">
  
                <a>
                    <img src="http://159.223.163.191/assets/mail/images/svg_1.png" alt="Twitter Logo" class="social_media_icons">
                </a>
                <a>
                    <img src="http://159.223.163.191/assets/mail/images/svg_1-1.png" alt="Facebook Logo" class="social_media_icons">
                </a>
                <a>
                    <img src="http://159.223.163.191/assets/mail/images/svg_1-1-2.png" alt="Instagram Logo" class="social_media_icons">
                </a>
                <a>
                    <img src="http://159.223.163.191/assets/mail/images/svg_1-1-2-3.png" alt="Youtube Logo" class="social_media_icons">
                </a>
                <a>
                    <img src="http://159.223.163.191/assets/mail/images/svg_1-1-2-3-4.png" alt="Telegram Logo" class="social_media_icons">
                </a>
  
              </div>
  
                </td>
  
              </tr>
  
             <tr>
  
               <td style="padding:2px;background-color:#ffffff;text-align:center">
  
               <p style="color:#000">This is an automated message, please do not reply.</P>
  
               </td>
  
            </tr>
  
            <tr>
  
               <td style="padding:2px;background-color:#ffffff;text-align:center">
  
               <p style="color:#000">© 2022 - 2023 Pyracenter.com, All Rights Reserved.</P>
  
               </td>
  
            </tr>
  
            </table>
  
          </td>
  
        </tr>
  
      </table>
  
    </div>
  
  </body>

  </html>`
  }

  /** ACCESS TOKEN METHODS */
  this.generateToken = function (data, secret, expireTime) {
    return new Promise(function (resolve, reject) {
      jwt.sign(data, secret, { expiresIn: expireTime }, (err, token) => {
        if (err) {
          reject(err);
        } else {
          resolve(token);
        }
      });
    });
  };

  this.getDataFromToken = function (token, secret) {
    var result = {};
    return new Promise(function (resolve) {
      jwt.verify(token, secret, (err, payload) => {
        if (err) {
          result.error = true;
          result.data = null;
          resolve(result);
        } else {
          result.error = false;
          result.data = payload;
          resolve(result);
        }
      });
    });
  };

  /** GENERATE UNIQUE ID */
  this.makeUniqueID = (length) => {
    let result = "";
    let characters =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  };

  /** HASH PASSWORD METHODS */
  this.generatehash = function (password, callback) {
    bcrypt.genSalt(10, function (err, salt) {
      if (err) console.log(err);
      callback(salt);
    });
  };

  this.generatePassword = function (data, callback) {
    var passwordResponse = {};
    bcrypt.hash(data.password, data.hash, null, function (err, hash) {
      if (err) {
        passwordResponse.error = true;
        callback(passwordResponse);
      } else {
        passwordResponse.error = false;
        passwordResponse.hashPassword = hash;
        callback(passwordResponse);
      }
    });
  };

  this.comparePassword = function (data, password) {
    return new Promise(function (resolve, reject) {
      bcrypt.compare(password, data.password, function (err, res) {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  };

  /** MAIL METHODS */
  /*var smtpTransport = nodemailer.createTransport({
    service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: true,
    auth: {
      user: "john@pyramidions.com",
      pass: "paul123@paul",
    },
  });*/

  var smtpTransport = nodemailer.createTransport({
    name:"smtp.gmail.com",
    host: "smtp.gmail.com",
    port: 587,
    //port:465,
    //secure: true,
    auth: {
      user: "hello@doo.world",//"dooworld1@gmail.com",
      pass: "hkvondtwklufwiuz",//"A1234@@4321z"//"mwreyvgfdtymjstw",
    },
  });

  this.sendVerifyMail = function (data, callback) {
    var mailHtml = "";
    if (data.type && data.type == "Register") {
      mailHtml = this.returnMailContent({title:"WELCOME! "+data.firstName,buttonLink:"http://54.219.39.240:8000/account/login?token="+data.accessToken,buttonName:"Log In",message:"Click on the above link to verify your E-mail address and login to your pyra center account"})
    } else {
      mailHtml = this.returnMailContent({title:"OTP",buttonLink:"OTP",buttonName:data.otp,message:"Please enter the above 6 digit OTP on pyra center OTP screen to verify your E-mail address"})
    }
    var mailOptions = {
      //from: "Pyra Center <john@pyramidions.com>",
      from:"Doo World <hello@doo.world>",
      to: data.email,
      subject: "Welcome to Doo World",
      html: mailHtml,
    };
    smtpTransport.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log(error);
      }
      callback(response);
    });
  };

  this.sendForgotPasswordMail = function (data, callback) {
    var mailOptions = {
      //from: "Pyra Center <john@pyramidions.com>",
      from:"Doo dev <hello@doo.world>",
      to: data.email,
      //to:"yogeshofficial1997@gmail.com",
      subject: "Password Reset",
      html: this.returnMailContent({title:"FORGOT PASSWORD",buttonLink:"http://54.219.39.240:8000/account/reset-password?token="+data.token,buttonName:"RESET PASSWORD",message:"We have received a request for a password change from you , click on the above link to reset your account password, if you does not requested this change, you can ignore this mail and use your current password"})
    };
    smtpTransport.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log(error);
      }      
      console.log(error,response)
      callback(response);
    });
  };

  this.sendMailNotification = function (data, callback) {
    var mailOptions = {
      //from: "Pyra Center <john@pyramidions.com>",
      from:"Doo dev <hello@doo.world>",
      to: data.email,
      subject: data.subject,
      html: data.htmlContent,
    };
    smtpTransport.sendMail(mailOptions, function (error, response) {
      if (error) {
        console.log(error);
      }
      callback(response);
    });
  };
};
