process.env.TZ = 'Europe/Amsterdam';
const Discord = require('discord.js');
const mysql = require('mysql');
const randomColor = require('randomcolor');
const config = require('./conf.json');
const quizCommands = require('./cmd_modules/quiz.js');
const mainCommands = require('./cmd_modules/main.js');
const groupCommands = require('./cmd_modules/group.js');
const { group } = require('console');
const prefix = config.discord.prefix;
const standardEmbedMes = config.discord.standardEmbedMes;
// Initialize Discord client
const client = new Discord.Client();
client.on('ready', () => {
    console.log('Connected');
    client.user.setActivity("For !help",{type:"WATCHING"});
});

const mysqlConnection = mysql.createConnection(config.mysql.connectJson);
mysqlConnection.connect(function (err) {
    if (err) throw err;
    console.log("Connected to database!");
});
client.on('message', async message => {
    if (message.channel instanceof Discord.DMChannel) return;
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix)) return;
    await checkGuild(message);
    const commandBody = message.content.slice(prefix.length);
    const args = commandBody.split(' ');
    const command = args.shift().toLowerCase();
    let findCommandQuery = "select * from commands join groups on group_id = groups_group_id where command_name = ? or (group_name = ? and command_name = ?)";
    findCommandQuery = mysql.format(findCommandQuery, [command, command, args[0]]);
    mysqlConnection.query(findCommandQuery, function (error, results) {
        if (error) throw error;
        console.log(results);
        if (results[0] == null) message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No such command", "No command found called `" + command + "`\nType `" + prefix + "help` in order to view all commands", message, client) });
        else {
            console.log(results[0].group_name == "group");
            switch (results[0].group_name) {
                case "main":
                    if (args[0] == "help") {
                        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) });
                    }
                    else {
                        mainCommands.main(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                case "quiz":
                    if (args[1] == "help") {
                        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) });
                    }
                    else {
                        quizCommands.quiz(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                case "group":
                    if(args[1] == "help") {
                        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, results[0].command_name + " template", results[0].command_help + "Use:`" + prefix + results[0].command_template + "`", message, client) });
                    }
                    else {
                        groupCommands.group(results[0].function_name, message, client, args, prefix, mysqlConnection);
                    }
                    break;
                default:
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No such command", "No command found called `" + command + "`\nType `" + prefix + "help` in order to view all commands", message, client) });
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