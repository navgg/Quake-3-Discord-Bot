const Discord = require('discord.js');
const requestify = require('requestify');
const fs = require('fs');

const tools = require('./tools');
const data = require('./data');
const config = require('./config');

const bot = new Discord.Client();
const APIurl = `http://${config.baseaddr}/API/`;

const ID_CMD = 0;
const ID_FUNC = 1;
const ID_INFO = 2;
const ID_HELP = 3;

//init custom extensions
tools.init();

var knownservers = data.knownservers;

var getArgs = message => message.content.split(' ');

var getRandomWords = () => {
	var w1 = data.rwords1[Math.floor(Math.random() * data.rwords1.length)]; 
	var w2 = data.rwords2[Math.floor(Math.random() * data.rwords2.length)]; 
	
	//console.log(w1 + " " + w2);
	
	return w1 + " " + w2;
}

var getCustomEnding = () => data.customendings[Math.floor(Math.random() * data.customendings.length)]; 

// shot someone msg1 - if someone was mentioned, msg2 - if nobody was mentioned
var shot = (message, msg1, msg2) => {
	var args = message.content.split(' ');
	var msg = "";
	var author = message.author;		
	
	var ments = "";
	var firstMent = true;
	
	message.mentions.users.forEach(u => {			
		if (firstMent) {
			firstMent = false;
			ments += u;		
		} else {
			ments += " " + u;		
		}
	});		
	
	//console.log("mentions: " + ments + ".");
	
	//var matches = message.content.match(/\(([^)]+)\)/);
	var firstI = message.content.indexOf('(') + 1;
	var lastI = message.content.lastIndexOf(')');
	//var custom = matches && matches.length > 0 ? matches[1] : undefined;		
	
	var custom = firstI > 0 && lastI > 0 ? message.content.substring(firstI, lastI) : undefined;
	
	//console.log(custom);
	
	if (ments.length > 0) {			
		msg += msg1
			.replace('%t', ments)
			.replace('%a', author)
	} else {
		msg += msg2
			.replace('%a', author)			
	}
	
	if (msg.indexOf('%r') > 0)
		msg = custom != undefined ? 
			msg.replace('%r', custom) : 
			msg.replace('%r', getRandomWords());
	else if (custom != undefined)
		msg += " " + (custom == 'r' || firstI == lastI ? getCustomEnding() : custom);	
	
	message.channel.send(msg);
}

var getKnownServers = () => {
	var res = "```";
	for(var i = 0; i < knownservers.length; i++)
		res += "" + knownservers[i][0].padEnd(7) + " " + knownservers[i][2] + "\n";
	res += "```";
	return res;
}

var getGameVersion = (protocol) => {
	switch(protocol) {
		case '43' : return '1.11-1.16';
		case '45' : return '1.17';
		case '48' : return '1.2x';
		case '66' : return '1.30';
		case '67' : return '1.31';
		case '68' : return '1.32';
		default: 'unknown';
	}
}

var getKnownServerIP = (tmp) => {
	for(var i = 0; i < knownservers.length; i++)
		if (knownservers[i][0] == tmp)
			return knownservers[i][1];

	return tmp;
}

//return help if not found return quick info
var getHelp = cmd => {		
	for (var i = 0; i < cmds.length; i++) 
		if (cmds[i][ID_CMD] == cmd) {
			var help = cmds[i][ID_HELP];
			if (!help) {
				var qhelp = cmds[i][ID_INFO];				
				return (qhelp && qhelp.length > 1 ? qhelp.trim() : `No additional info for command \\${cmd}`);					
			} else {
				return help.trim();
			}			
		}
		
	return `I don't know command \\${cmd}`;
}

//validate map name
var isMapNameValid = map => {
	return new Promise((resolve, reject) => {
		if (map.match(/^q3dm[0-1]?\d$/g) || 
			map.match(/^q3tourney[1-6]$/g) || 
			map.match(/^q3ctf[1-4]$/g) || 
			map.match(/^(test_bigbox|q3tourney6_ctf|aim4bfg|13box)$/g)) {
			resolve(1);
			return;
		}

		requestify.head(`http://ws.q3df.org/maps/download/${map}`)
			.then(response => {
				//get pk3 name and check if it's exists
				var pk3 = /"(.+)"$/g.exec(response.headers["content-disposition"])[1];
				try {
					console.log(pk3);
					resolve(fs.existsSync(config.baseq3path + pk3) ? 1 : 2);
				} catch(err) {
					console.error(err);
					reject(-1);
				}
			}).fail(response => {
				if (response.getCode() == 302)
					resolve(0);
				else
					reject(-1);
			});
	});
}

var switchMapTime = 0;
var switchMapInterval = 5000;
// map switch command
var switchMap = message => {
	//delete message if its in public channel
	if (message.guild !== null)
		message.delete(1000);
	
	if (switchMapTime + switchMapInterval > Date.now()) {
		var w = ((switchMapInterval - (Date.now() - switchMapTime))/1000).toFixed();
		message.author.send(`Interval between map calls is ${switchMapInterval/1000}sec. Wait ${w}sec`);
		return;
	}
	
	var caller = message.author.username + '#' + message.author.discriminator;
	var args = getArgs(message);

	if (args && args.length > 1) {
		var map = args[1].trim().toLowerCase();
		var port = 27962;
		var serv = 'ctf';
		
		if (args.length > 2) {
			var serv = args[2].trim().toLowerCase();
			switch(serv) {
				case 'ffa': port = 27961; break;
				case 'ctf': port = 27962; break;
				case '1v1': port = 27963; break;
				default: 
					message.author.send(`unknown server ${serv}, known servers: ctf, ffa, 1v1`);
					return;
			}
		}
		
		if (map == 'q3dm0' && serv == 'ctf') {
			message.author.send("q3dm0 doesn't work on ctf server");
			return;
		}
		
		switchMapTime = Date.now();

		var msg = `called map \`${map}\` on **${serv}** server.`;
		var con = `\\connect ${config.baseaddr}:${port}`;
		var help = '`\\help map\` - for mo info';
			
		isMapNameValid(map).then(res => {
			if (res == 1) {
				requestify.get(APIurl + `nextmap?map=${encodeURIComponent(map)}&caller=${encodeURIComponent(caller)}&port=${port}`)
					.then(response => {
						message.author.send(`You've ${msg} ${con} ${help}`);
					}).fail(response => {
						message.author.send('Map switch failed');
					});
			} else if (res == 2) {
				message.author.send(`Server has no map \`${map}\`. Contact admin to download it.`);
			} else {
				message.author.send(`\`${map}\` name is wrong or I don't know such map`);
			}
		}, err => {
			console.log('isMapNameValid ' + err);
			message.author.send('Something wrong happened. Contact admin to fix this error.');
		});
	} else {
		message.author.send(getHelp('map'));
	}
};

// pings servers, gestatus sets serverInfo and players variables
var pingServer = (message, showInfo, showPlayers, editMessage) => {
	var args = !editMessage ? getArgs(message) : editMessage.split(' ');
	var paramStr = '';
	
	if (args && args.length > 1) {	
		var tmp = args[1].trim();
		var ip = '';
		var port = 27960;
		
		if (tmp.indexOf(':') < 0)	
			tmp = getKnownServerIP(tmp);				

		if (tmp.indexOf(':') > 0) {
			var splits = tmp.split(':');
			ip = splits[0];
			port = parseInt(splits[1]);
			if (!port || port <= 0 || port > 65535 || port == NaN) {
				message.channel.send('Invalid port ' + splits[1] + ', must be between 1 and 65535');
				return;
			}			
		} else {
			ip = tmp;
		}
		
		if (ip.length <= 5) {
			message.channel.send('Invalid ip ' + ip);
			return;
		}
		
		paramStr = "?ip=" + ip + "&port=" + port;
		
		//console.log(tmp + ' -> ' + paramStr);
	} else {			
		message.channel.send(getHelp('ping'));
		return;
	}

	requestify.get(APIurl + 'getstatus' + paramStr)
		.then(response => {	
			var resp = response.getBody();
			var players = undefined;
			var serverInfo = undefined;
			
			//console.log(resp);
			
			eval(resp);
			
			// console.log(serverInfo);
			// console.log(players);				
			
			var msg = "";
			
			if (serverInfo == undefined || serverInfo.sv_hostname == null) {
				msg += "Server is not responding or ip adress is wrong";
			} else {								
				msg += "`" + serverInfo.sv_hostname.replace(/\^[^\^]/g, "").trim() + "` " + "`(Q3 " + getGameVersion(serverInfo.protocol) + ")` " 
					 + "`" + ip + ":" + port + "`"  + "\n";
				msg += "`Map: " + serverInfo.mapname + "` `" + serverInfo.sm_ClientsString + "`\n";					
			
				if (showPlayers) {											
					msg += "```";
				
					if (players.length == 0) {
						msg += "Server is empty";
					} else {						
						msg += "*Name*".padEnd(30) + " " + "*Ping*".padStart(6) + " " + "*Score*".padStart(7) + "\n";
						
						for(var i = 0; i < players.length; i++) {
							msg += players[i].SimpleName.replace(/[\u0000-\u001F]+/gi, '[]').padEnd(30) + " ";
							msg += players[i].Ping.padStart(5) + " ";
							msg += players[i].Score.toString().padStart(7) + "\n";
						}
					}	

					msg += "```";		
				} else if (showInfo) {										
					msg += "```";
					
					for (var prop in serverInfo)
						if (!prop.startsWith('sm_'))					
							msg += `${prop}: ${serverInfo[prop]}\n`;					
					
					msg += "```";
				}
			}
			
			if (editMessage) {
				message.edit(msg);
			} else {
				if (showPlayers)
					message.channel.send(msg).then(async function (message) {					
						await message.react("🔄");					
					}).catch(function() {
						console.log("Something wrong");
					});
				else 
					message.channel.send(msg);
			}
		}
	);
}

//all commands: command name, function, quick info, help description
var cmds = [
	[ 'help', message => { 
		var args = getArgs(message);
	
		var msg = "";
				
		if (args && args.length > 1) {
			var cmd = args[1].trim().toLowerCase();

			msg += getHelp(cmd);
		} else {				
			for (var i = 0; i < cmds.length; i++) 
				if (cmds[i][ID_INFO])
					msg += "**\\" + cmds[i][ID_CMD] + "**" + (cmds[i][ID_INFO].length > 1 ? " - " : "") + cmds[i][ID_INFO];
		}
	
		msg += "";
	
		message.channel.send(msg);
	}, 'display quick help\n' ],		
	
	[ 'ping', message => pingServer(message, false, true), 
		'pings any known server or any ip:port\n', 
		"`\\ping sm` - pings sodmod ctf `\\ping 139.5.28.161:27961` - pings specified ip:port\n`\\servers` - display known servers"],
	
	[ 'info', message => pingServer(message, true, false), 
		'gets serverinfo of any known server or any ip:port\n', 
		"`\\info sm` - serverinfo of sodmod ctf `\\info 139.5.28.161:27961` - serverinfo of specified ip:port\n`\\servers` - display known servers"],
	
	[ 'servers', 	message => message.channel.send("Known servers:\n" + getKnownServers()), ''],
	
	[ 'map', 		message => switchMap(message), 'switch map on the specified server\n', 
		'`\\map q3wcp16` - set map on ctf server\n' +
		'`\\map q3tourney6 ffa` - set map on ffa server\n' +
		'Known servers: ctf, ffa, 1v1'],
	
	[ 'md',			message => shot(message, '%a drawing %r with machinegun on wall for %t',	'%a drawing %r with machinegun on wall'),	],
	[ 'mgdraw',		message => shot(message, '%a drawing %r with machinegun on wall for %t',	'%a drawing %r with machinegun on wall'),
		'',
		'`\\md` - draw random `\\md @Name` - draw random for someone `\\md @Name (sacred relic)` - draw custom for someone'],
		
	[ 'rd',			message => shot(message, '%a drawing %r with railgun on wall for %t', 		'%a drawing %r with railgun on wall'),		],
	[ 'raildraw',	message => shot(message, '%a drawing %r with railgun on wall for %t', 		'%a drawing %r with railgun on wall'),
		'',
		'`\\md` - draw random `\\md @Name` - draw random for someone `\\md @Name (colorful rainbow)` - draw custom for someone'],
	
	[ 'pummel', 	message => shot(message, '%t was pummeled by %a', 				'%a seeking blood'),	 					'' ],
	[ 'mg', 		message => shot(message, '%t was machinegunned by %a', 			'%a drawing %r with machinegun on wall'),	'', "it's machinegun" ],
	[ 'shotgun', 	message => shot(message, "%t was gunned down by %a", 			'%a shooting in air with shotgun'),			'' ],
	[ 'grenade', 	message => shot(message, "%t was shredded by %a's shrapnel", 	'%a tripped on its own grenade'), 			'' ],
	[ 'rocket', 	message => shot(message, "%t ate %a's rocket", 					'%a blew itself up'),						'' ],	
	[ 'lg', 		message => shot(message, "%t was electrocuted by %a", 			"%a electrolucing it's butt"), 				'', "it's lightning gun (shaft)" ],
	[ 'shaft', 		message => shot(message, "%t was electrocuted by %a", 			"%a electrolucing it's butt"),				   ],
	[ 'rail', 		message => shot(message, '%t was railed by %a', 				"%a drawing %r with rail on wall"),			'' ],
	[ 'plasma', 	message => shot(message, "%t was melted by %a's plasmagun", 	'%a melted itself'), 						'' ],
	[ 'bfg', 		message => shot(message, "%t was blasted by %a's BFG", 			'%a should have used a smaller gun'), 		'' ],
	
	[ 'stuff', 		message => message.channel.send(
		'**\\servers** - display known servers\n' +
		'**\\mgdraw** - use machinegun to draw random stuff on wall\n' +
		'**\\raildraw** - use railgun to draw random stuff on wall\n' +
		'**\\pummel \\mg \\shotgun \\grenade \\rocket \\lg \\rail \\plasma \\bfg** - use any weapon to attack \n' +
		'Examples: `\\rail @Name` `\\lg` `\\rocket @Name (with quad)` `\\bfg @Name (r)`\n' +
		'write in `( )` any custom ending, r - for random generated'), 'other commands' ],
		
	[ 'name',		message => message.channel.send(getRandomWords()),				, 'generate random name' ]
]

//push short info for some quake 3 commands
var pushQ3commands = () => {
	for(var j in data.q3commands) {				
		cmds.push([
			data.q3commands[data.q3commands.length - j - 1][0],
			(message, i) => {				
				i = cmds.length - i - 1;
				
				var defaultVal  = data.q3commands[i][1];
				var recommended = data.q3commands[i][2] ? `recommended: ${data.q3commands[i][2]}` : "";
				
				message.channel.send(data.q3commands[i][3] + "\n`" + `default: ${defaultVal} ${recommended}` + "`");
			}
		]);
	}
}

pushQ3commands();

bot.on('messageReactionAdd', (reaction, user) => {	
	if(reaction.emoji.name === "🔄") {									
		if (!user.bot) {
			var matches = reaction.message.content.match(/`(.*?)`/gi);
			if (matches && matches.length >= 3) {
				var ip = matches[2].replace(/`/g, "");					
				
				reaction.remove(user).then(reaction =>  {
					console.log("Refresh clicked " + user.username);
				}, error =>  {
					console.log('Unexpected error: ' + error);
				});
				
				pingServer(reaction.message, false, true, "\ping " + ip);			
			}			
		}
	}		
});

bot.on('message', message => {	
	//console.log(message.content);
	
	if (message.content.substring(0, 1) == config.prefix) {						
		var args = message.content.substring(1).split(' ');
		var cmd = args[0];
		
		var a = message.author.username + '#' + message.author.discriminator;
		console.log(`${new Date().toLocaleString()} ${a} ${message.content}`);
	   
		//args = args.splice(1);
		
		for(var i = 0; i < cmds.length; i++)
			if (cmd == cmds[i][ID_CMD])
				cmds[i][ID_FUNC](message, i);		
	}		
});

bot.on("guildMemberAdd", member => {
	console.log(`New User "${member.user.username}" has joined "${member.guild.name}"` );

	var channel = member.guild.channels.find("id", config.MAIN_CHANNEL_ID);  

	if (channel) {	  
		var infochannel = member.guild.channels.find("id", config.INFO_CHANNEL_ID);

		var emoji1 = bot.emojis.find("name", "q3excellent");
		var emoji2 = bot.emojis.find("name", "q3wbfg");

		var msg = `Welcome, ${member.user}! ${emoji1 || ""} Check ${infochannel} for quick help, have fun ${emoji2 || ""}`;
		channel.send(msg);
	}
	
	var role = member.guild.roles.find("name", "🎮Quakers");
	
	if (role) {
		member.addRole(role).catch(console.error);
	}
});

bot.on('ready', evt => {	
	//bot.user.setUsername(confin.username);
	bot.user.setActivity(config.activity);
    console.log('Connected as: ' + bot.user.tag);    
	//console.log(`Ready to serve on ${bot.guilds.size} servers, for ${bot.users.size} users.`);
});

bot.on('error', error => {
	if (error) {
		console.log(error);
	}
	// if (error && error.message === 'uWs client connection error') {
		// console.log('Reconnecting....');
		// this.reconnect();
		// return;
	// }
});

if (config.token === '')
	throw new Error('Token is not defined');	

bot.login(config.token);

console.log('Connecting...');
