var express = require('express');
var socketio = require('socket.io');
var app = express();
var fs = require('fs');

var https = require('https');
var http = require('http');
var qs = require('qs');




//获取token，并通过文件存储
function getToken() {
	return new Promise(function(resolve, reject) {
		var token;
		//先看是否有token缓存，这里用文件缓存
		if (fs.existsSync('token.dat')) {
			token = JSON.parse(fs.readFileSync('token.dat'));
		}

		//如果没有缓存或者过期
		if (!token || token.timeout < Date.now()) {
			https.get("https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=wx930914501a248f96&secret=b337e9ef931d95dfe274f4c031eecbdc", function(res) {
    			var html = ''; // 保存抓取
   				res.setEncoding('utf-8');
    			// 抓取页面内容
    			res.on('data', function(chunk) {
        			html += chunk;
    			});

    			//网页内容抓取完毕
    			res.on('end', function() {
    				var result = JSON.parse(html);
    				result.timeout = Date.now() + 7000000;
    				//更新token并缓存
        			
    				fs.writeFileSync('token.dat', JSON.stringify(result));
    				resolve(result);
    			});

			}).on('error', function(err) {
    			console.log(err);
			});
		} else {
			resolve(token);
		}
	});
}

//获取用户信息
function getUserInfo(openID) {
	return getToken().then(function(res) {
		var token = res.access_token;

		return new Promise(function (resolve, reject) {
			https.get('https://api.weixin.qq.com/cgi-bin/user/info?access_token='+token+'&openid='+openID+'&lang=zh_CN', function(res) {
				var html = ''; // 保存抓取
   				res.setEncoding('utf-8');
    			// 抓取页面内容
    			res.on('data', function(chunk) {
        			html += chunk;
    			});
    			res.on('end', function() {
    				resolve(JSON.parse(html));
    			})
				
			}).on('error', function(err) {
				console.log(err);
			});
		});
	}).catch(function(err) {
		console.log(err);
	});
}


//验证签名

//返回统一页面
app.use(express.static(__dirname + '/client'));

app.use(function (req, res) {
	res.sendFile(__dirname + '/client/index.html')
});

var clientServer = app.listen(3002, function () {
	console.log('app is running at port 3002!');
});

var io = socketio.listen(clientServer);
io.sockets.on('connection', function (socket) {
	console.log('connected');
	socket.emit('connected');
	socket.broadcast.emit('newClient', new Date());
});

//微信端接收信息
var wxserver = http.createServer(function (request, response) {
	//解析URL中的query部分，用qs模块(npm install qs)将query解析成json
	var query = require('url').parse(request.url).query;
	var params = qs.parse(query);

	if (request.method == "GET") {
		//如果请求是GET，返回echostr用于通过服务器有效校验
		response.end(params.echostr);
	} else {
		//否则是微信给开发者服务器的POST请求
		var postdata = "";

		request.addListener("data", function (postchunk) {
			postdata += postchunk;
		});

		//获取到了POST数据
		request.addListener("end", function () {
			var parseString = require('xml2js').parseString;

			parseString(postdata, function (err, result) {
				if (!err) {
					getUserInfo(result.xml.FromUserName[0]).then(function (userInfo) {
						result.user = userInfo;
						console.log(result);
						io.sockets.emit('newMessage', result);
						response.end();
					});
					
				}
				return result;
			});
		});

	}

});
wxserver.listen(3001);
console.log("WxServer running at port:3001!");

						















