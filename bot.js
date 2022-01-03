process.env.TZ = 'Europe/Amsterdam';
const Discord = require('discord.js');
const mysql = require('mysql');
const randomColor = require('randomcolor');
const config = require('./conf.json');
const quizCommands = require('./cmd_modules/quiz.js');
const mainCommands = require('./cmd_modules/main.js');
const groupCommands = require('./cmd_modules/group.js');
const AsyncLock = require('async-lock');
const { group } = require('console');
const prefix = config.discord.prefix;
const standardEmbedMes = config.discord.standardEmbedMes;
// Initialize Discord client
global.client = new Discord.Client({intents: [Discord.Intents.FLAGS.GUILDS, Discord.Intents.FLAGS.GUILD_VOICE_STATES, Discord.Intents.FLAGS.GUILD_MESSAGES, Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS, Discord.Intents.FLAGS.DIRECT_MESSAGES]});
client.on('ready', () => {
    console.log('Connected');
    client.user.setActivity("For ?help",{type:"WATCHING"});
});

const mysqlConnection = mysql.createConnection(config.mysql.connectJson);
mysqlConnection.connect(function (err) {
    if (err) throw err;
    console.log("Connected to database!");
});

var lock = new AsyncLock();

client.on('messageCreate', async message => {
    if (message.channel instanceof Discord.DMChannel) return;
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix) && message.channel.id == channelId && tracksToPlay.length > 0 && scoreboard.length > 0 && scoreboard.map(a => a.memberId).includes(message.member.id)) {
        lock.acquire("processAnswer", async function(done) {
            await processAnswer(message);
            done();
        });
        return;
    }
    if (!message.content.startsWith(prefix)) return;
    await checkGuild(message);
    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    let findCommandQuery = "select * from commands join `groups` on group_id = groups_group_id where command_name = ? or (group_name = ? and command_name = ?)";
    findCommandQuery = mysql.format(findCommandQuery, [command, command, args[0]]);
    mysqlConnection.query(findCommandQuery, function (error, results) {
        if (error) throw error;
        console.log(results);
        if (results[0] == null) message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "No such command", "No command found called `" + command + "`\nType `" + prefix + "help` in order to view all commands", message, client)] });
        else {
            console.log(results[0].group_name == "group");
            switch (results[0].group_name) {
                case "main":
                    if (args[0] == "help") {
                        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) ]});
                    }
                    else {
                        mainCommands.main(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                case "quiz":
                    if (args[1] == "help") {
                        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) ]});
                    }
                    else {
                        quizCommands.quiz(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                case "group":
                    if(args[1] == "help") {
                        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) ]});
                    }
                    else {
                        groupCommands.group(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                case "music":
                    if(args[1] == "help") {
                        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client)] });
                    }
                    else {
                        music(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                default:
                    message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "No such command", "No command found called `" + command + "`\nType `" + prefix + "help` in order to view all commands", message, client) ]});
            }
        }
    });
    message.delete().catch(console.error);
});

client.login(config.discord.token);

//ping request so the connection doesnt close
setInterval(function () {
    mysqlConnection.query('select 1', function () { });
}, 60000);

function generateStandardEmbed(standard, title, description, message, client) {
    let embed = standard.embed;
    embed.title = title;
    embed.description = description;
    embed.color = parseInt(randomColor().substring(1), 16);
    embed.timestamp = (new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, -1));
    embed.footer.icon_url = client.guilds.resolve(message.guild.id).members.resolve(client.user.id).user.avatarURL();
    embed.footer.text = client.user.username;
    embed.author.name = message.author.username;
    embed.author.icon_url = client.guilds.resolve(message.guild.id).members.resolve(message.author.id).user.avatarURL();
    return JSON.parse(JSON.stringify(embed));
}

function checkGuild(message) {
    return new Promise(res => {
        let checkGuild = "select guild_discord_id from guilds where guild_discord_id = ?";
        checkGuild = mysql.format(checkGuild, [message.guild.id]);
        mysqlConnection.query(checkGuild, function(err, results) {
            if(err) throw err;
            if(results[0] == null) {
                let insert = "insert into guilds values (?,?)";
                insert = mysql.format(insert, [message.guild.id, message.guild.name]);
                mysqlConnection.query(insert, function(error) {
                    if(error) throw error;
                    res(true);
                });
            }
            else res(true);
        });
    });
}

module.exports.client = client;


//music part, because it does not work otherwise
const fs = require("fs");
const spotify = require("spotify-web-api-node");
const { join }  = require("path");
console.log(__dirname);
const express = require("express");
const open = require("open");
var querystring = require("query-string");
var spotifyApi = new spotify(config.spotify.credsJson);
const { createAudioPlayer, NoSubscriberBehavior, createAudioResource, joinVoiceChannel, getVoiceConnection, StreamType} = require('@discordjs/voice');

const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
    }
});


var indexToPlay = 0;
var tracksToPlay = [];
var channelId = 0;
var scoreboard = [];


player.addListener("stateChange", (oldOne, newOne) => {
    if(newOne.status == "idle") {
        //pause between songs
        sendEndSongMessage(indexToPlay);
        setTimeout(function () {
            indexToPlay++;
            if(indexToPlay >= tracksToPlay.length) {
                quizIsDone();
            }
            else {
                songIsDone();
            }
        }, 2000);
    }
});

let app = express();

app.get('/login', function(req, res) {
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: config.spotify.credsJson.clientId,
      scope: scope,
      redirect_uri: config.spotify.credsJson.redirectUri,
      state: config.spotify.state
    }));
});

app.get('/callback', function(req, res) {
    setup(req.query.code);
});

app.listen(80);

open("http://localhost/login");

async function setup(code) {
    spotifyApi.authorizationCodeGrant(code).then(function(data){
    console.log('The token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);
    console.log('The refresh token is ' + data.body['refresh_token']);

    // Set the access token on the API object to use it in later calls
    spotifyApi.setAccessToken(data.body['access_token']);
    spotifyApi.setRefreshToken(data.body['refresh_token']);
  },
  function(err) {
    console.log('Something went wrong when retrieving an access token', err);
  });
}

async function music(funcName, message, client, args, prefix, mysqlCon) {
    eval(funcName + "(message,client,args,prefix,mysqlCon)");
}

async function quizFunc(message, client, args, prefix, mysqlCon) {
    if(!message.member.voice.channel) {
        message.channel.send({"embeds": [generateStandardEmbed(standardEmbedMes, "Not in voice channel","Please join a voice channel", message, client)]});
        return;
    }
    if (args.length < 2 || isNaN(args[1])) {
        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Missing parameter", "Give the amount of rounds\n e.g: `"+prefix+"music quiz 10`", message, client)] });
        return;
    }
    var amountOfRounds = args[1];
    message.channel.send({"embeds": [generateStandardEmbed(standardEmbedMes, "Fetching playlist", "The playlist is being fetched and the quiz is being prepared.\nThis might take a few seconds, depending on the size of the playlist.\nThe quiz will start 10 seconds after the playlist has been fetched.\n\nYou can guess either the title (for 1 point) or the artist (for 2 points) just by typing the answer.\nEach song will play for 30 seconds (pause of 2 seconds between each song).\n\nGood luck!", message, client)]});
    refreshToken();
    try {
        if(args.length >= 3) tracksToPlay = await getPlaylistAndPutInObject(args[2], amountOfRounds);
        else tracksToPlay = await getPlaylistAndPutInObject(config.spotify.playlistId, amountOfRounds);
    }
    catch (error) {
        console.log(error);
        message.channel.send({"embeds": [generateStandardEmbed(standardEmbedMes, "Error occured", "Error occured fetching playlist with the specified ID", message, client)]});
        return;
    }
    setTimeout(()=>{
        startQuiz(message);
    }, 10000);
}

async function processAnswer(message) {
    var scoreboardObject = scoreboard.find(value => value.memberId == message.member.id);
    //debug ifs
    var correctArtist = await check(message.content, tracksToPlay[indexToPlay].artists);
    var correctTitle = await check(message.content, [tracksToPlay[indexToPlay].name]);
    if((correctTitle && !tracksToPlay[indexToPlay].titleGuessed) || (correctArtist && !tracksToPlay[indexToPlay].artistGuessed)) {
        message.react('✅');
        if(correctArtist) {
            message.channel.send(message.member.toString()+" has correctly guessed the artist, 2 point given!");        
            tracksToPlay[indexToPlay].artistGuessed = true;
            scoreboardObject.points+=2;
        }
        else {
            message.channel.send(message.member.toString()+" has correctly guessed the title, 1 point given!");        
            tracksToPlay[indexToPlay].titleGuessed = true;
            scoreboardObject.points++;
        }
        if(tracksToPlay[indexToPlay].titleGuessed && tracksToPlay[indexToPlay].artistGuessed) {
            player.stop();
        }
    }
    else {
        message.react('❌');
    }
}

async function check(guessed, list) {
    guessed = regexTime(guessed);
    return list.includes(guessed);
}

function sendEndSongMessage(indexToUse) {
    var channel = client.channels.cache.find(channel => channel.id === channelId);
    var embedMessage = JSON.parse(JSON.stringify(config.discord.standardSongMes));
    var track = tracksToPlay[indexToUse];
    scoreboard.sort((a,b) => 
         b.points - a.points
    );
    //console.log(scoreboard);
    embedMessage.embeds[0].title = embedMessage.embeds[0].title.replace("{song}", track.nameNormal);
    embedMessage.embeds[0].title = embedMessage.embeds[0].title.replace("{artists}", track.artistsNormal.join(" & "));
    embedMessage.embeds[0].color = parseInt(randomColor().substring(1), 16);
    embedMessage.embeds[0].timestamp = (new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, -1));
    embedMessage.embeds[0].thumbnail.url = track.image_url;
    embedMessage.embeds[0].footer.text = embedMessage.embeds[0].footer.text.replace("{round}", indexToUse+1);
    embedMessage.embeds[0].footer.text = embedMessage.embeds[0].footer.text.replace("{maxRound}", tracksToPlay.length);
    var currentRankIndex = 0;
    var lastPoints = scoreboard[0].points;
    for(var i = 0;i<3 && i<scoreboard.length;i++) {
        var member = channel.members.get(scoreboard[i].memberId);
        var points = scoreboard[i].points;
        if(points < lastPoints) {
            currentRankIndex++;
        }
        lastPoints = points;
        embedMessage.embeds[0].description+=config.discord.standardSongMesRanks[currentRankIndex]+" - "+member.toString()+" - "+points+" pts\n";
    }
    channel.send(embedMessage);
}


function regexTime(stringToRegexAndStuff) {
    stringToRegexAndStuff = removeAllThosePeskyDiacritics(stringToRegexAndStuff);
    stringToRegexAndStuff = stringToRegexAndStuff.split('-')[0].toUpperCase();
    stringToRegexAndStuff = stringToRegexAndStuff.split(',')[0];
    stringToRegexAndStuff = stringToRegexAndStuff.replace(/ *\([^)]*\) */g, "");
    stringToRegexAndStuff = stringToRegexAndStuff.replace(/ *\[[^)]*\] */g, "");
    stringToRegexAndStuff = stringToRegexAndStuff.replace(/ *\{[^)]*\} */g, "");
    return stringToRegexAndStuff.replace(/[^a-zA-Z0-9]/g, "").trim();
}

function removeAllThosePeskyDiacritics(stringToRemove) {
  for(var i=0; i<diacriticsMap.length; i++) {
    stringToRemove = stringToRemove.replace(diacriticsMap[i].letters, diacriticsMap[i].base);
  }
  return stringToRemove;
}

async function startQuiz(message) {
    var voiceChannel = message.member.voice.channel;
    voiceChannel.members.forEach(member => {
        scoreboard.push({
            "memberId": member.id,
            "memberName": member.displayName,
            "correctAnswers": 0,
            "points": 0
        });
    });
    connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.channel.guild.voiceAdapterCreator
    });
    connection.subscribe(player);
    indexToPlay = 0;
    channelId = message.channel.id;
    songIsDone();
}

async function songIsDone() {
    playMusic(tracksToPlay[indexToPlay].preview_url);
}

function playMusic(musicToPlay) {
    const resource = createAudioResource(musicToPlay);
    player.play(resource);
}

async function quizIsDone() {
    var channel = client.channels.cache.find(channel => channel.id === channelId);
    scoreboard.sort((a,b) => 
         b.points - a.points
    );
    //console.log(scoreboard);
    var embedMessage = JSON.parse(JSON.stringify(config.discord.standardSongMes));
    embedMessage.embeds[0].title = "Music quiz is over, congratulations to the winner(s)!";
    embedMessage.embeds[0].color = parseInt(randomColor().substring(1), 16);
    embedMessage.embeds[0].timestamp = (new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, -1));
    embedMessage.embeds[0].footer = null;
    embedMessage.embeds[0].thumbnail = null;
    var currentRankIndex = 0;
    var lastPoints = scoreboard[0].points;
    scoreboard.forEach(listing=> {
        var member = channel.members.get(listing.memberId);
        var points = listing.points;
        if(points < lastPoints) {
            currentRankIndex++;
        }
        lastPoints = points;
        if(currentRankIndex < 3) {
            embedMessage.embeds[0].description+=config.discord.standardSongMesRanks[currentRankIndex]+" - "+member.toString()+" - "+points+" pts\n";
        }
        else {
            embedMessage.embeds[0].description+=currentRankIndex+" - "+member.toString()+" - "+points+" pts\n";
        }
    });
    channel.send(embedMessage);
    const connection = getVoiceConnection(channel.guildId);
    connection.destroy();
    indexToPlay = 0;
    tracksToPlay = [];
    channelId = 0;
    scoreboard = [];
}

async function getPlaylistAndPutInObject(playlistId, amountOfTracks) {
    let tracks = []
    const { body } = await spotifyApi.getPlaylistTracks(playlistId)
    tracks = body.items
    if (body.total > 100)
    for (let i = 1; i < Math.ceil(body.total / 100); i++) {
      const add = await spotifyApi.getPlaylistTracks(playlistId, { offset: 100 * i })
      tracks = [...tracks, ...add.body.items]
    }
    var playlistObject = [];
    tracks.forEach(track=> {
        if(track.track.preview_url) {
            var artists = [];
            var normalArtists = [];
            track.track.artists.forEach(artist=> {
                artists.push(regexTime(artist.name));
                normalArtists.push(artist.name);
            });
            var trackObject = {
                "name":regexTime(track.track.name),
                "nameNormal": track.track.name,
                "artists": artists,
                "artistsNormal": normalArtists,
                "preview_url": track.track.preview_url,
                "image_url": track.track.album.images[0].url,
                "titleGuessed": false,
                "artistGuessed": false
            };
            playlistObject.push(trackObject);
        }
    });
    if(amountOfTracks > playlistObject.length) {
        amountOfTracks = playlistObject.length;
    }
    return playlistObject.sort(() => 0.5 - Math.random()).slice(0, amountOfTracks);
}

function refreshToken() {
    spotifyApi.refreshAccessToken().then(
        function(data) {
          console.log('The access token has been refreshed!');
      
          // Save the access token so that it's used in future calls
          spotifyApi.setAccessToken(data.body['access_token']);
        },
        function(err) {
          console.log('Could not refresh access token', err);
        }
      );
}

var diacriticsMap = [
    {'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
    {'base':'AA','letters':/[\uA732]/g},
    {'base':'AE','letters':/[\u00C4\u00C6\u01FC\u01E2]/g},
    {'base':'AO','letters':/[\uA734]/g},
    {'base':'AU','letters':/[\uA736]/g},
    {'base':'AV','letters':/[\uA738\uA73A]/g},
    {'base':'AY','letters':/[\uA73C]/g},
    {'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
    {'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
    {'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
    {'base':'DZ','letters':/[\u01F1\u01C4]/g},
    {'base':'Dz','letters':/[\u01F2\u01C5]/g},
    {'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
    {'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
    {'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
    {'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
    {'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
    {'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
    {'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
    {'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
    {'base':'LJ','letters':/[\u01C7]/g},
    {'base':'Lj','letters':/[\u01C8]/g},
    {'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
    {'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
    {'base':'NJ','letters':/[\u01CA]/g},
    {'base':'Nj','letters':/[\u01CB]/g},
    {'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
    {'base':'OE','letters':/[\u00D6\u0152]/g},
    {'base':'OI','letters':/[\u01A2]/g},
    {'base':'OO','letters':/[\uA74E]/g},
    {'base':'OU','letters':/[\u0222]/g},
    {'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
    {'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
    {'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
    {'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
    {'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
    {'base':'TZ','letters':/[\uA728]/g},
    {'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
    {'base':'UE','letters':/[\u00DC]/g},
    {'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
    {'base':'VY','letters':/[\uA760]/g},
    {'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
    {'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
    {'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
    {'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
    {'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
    {'base':'aa','letters':/[\uA733]/g},
    {'base':'ae','letters':/[\u00E4\u00E6\u01FD\u01E3]/g},
    {'base':'ao','letters':/[\uA735]/g},
    {'base':'au','letters':/[\uA737]/g},
    {'base':'av','letters':/[\uA739\uA73B]/g},
    {'base':'ay','letters':/[\uA73D]/g},
    {'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
    {'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
    {'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
    {'base':'dz','letters':/[\u01F3\u01C6]/g},
    {'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
    {'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
    {'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
    {'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
    {'base':'hv','letters':/[\u0195]/g},
    {'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
    {'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
    {'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
    {'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
    {'base':'lj','letters':/[\u01C9]/g},
    {'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
    {'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
    {'base':'nj','letters':/[\u01CC]/g},
    {'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
    {'base':'oe','letters': /[\u00F6\u0153]/g},
    {'base':'oi','letters':/[\u01A3]/g},
    {'base':'ou','letters':/[\u0223]/g},
    {'base':'oo','letters':/[\uA74F]/g},
    {'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
    {'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
    {'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
    {'base':'s','letters':/[\u0073\u24E2\uFF53\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
    {'base':'ss','letters':/[\u00DF]/g},
    {'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
    {'base':'tz','letters':/[\uA729]/g},
    {'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
    {'base':'ue','letters':/[\u00FC]/g},
    {'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
    {'base':'vy','letters':/[\uA761]/g},
    {'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
    {'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
    {'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
    {'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
];