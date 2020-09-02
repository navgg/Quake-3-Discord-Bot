const Discord = require('discord.js');
const requestify = require('requestify');

const tools = require('./tools');
const data = require('./data');
const config = require('./config');

const bot = new Discord.Client();

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

	requestify.get('http://sodmod.ga/API/getstatus' + paramStr)
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
		
		console.log(message.author + " " + message.content);
	   
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

if (config.token === '')
	throw new Error('Token is not defined');	

bot.login(config.token);

console.log('Connecting...');
