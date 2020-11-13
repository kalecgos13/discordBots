const conf = require('../conf.json');
const randomColor = require('randomcolor');
const standardEmbedMes = conf.discord.standardEmbedMes;
module.exports = {
    main: async function (funcName, message, client, args, prefix, mysqlCon) {
        eval(funcName + "(message,client,args, prefix, mysqlCon)");
    }
}

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

async function pingFunc(message, client, args, prefix, mysqlCon) {
    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Ping command", "Pong!\nLatency is `" + (Date.now() - message.createdTimestamp) + "ms`\nAPI Latency is `" + (Math.round(client.ws.ping)) + "ms`", message, client) });
}
async function helpFunc(message, client, args, prefix, mysqlCon) {
    let embedTemplate = generateStandardEmbed(standardEmbedMes, "Help command", "Here is a list of all available commands sorted by groups\n**NOTE: a 🛠️ infront of a command means that only certain roles can use it.**\n\nServer prefix =`" + prefix + "`.", message, client);
    mysqlCon.query("select * from commands join groups on groups_group_id = group_id order by groups_group_id", function (err, results) {
        if (err) throw err;
        let fieldsArr = [];
        let currentGroupId = -1;
        console.log(results);
        let index = 0;
        for (let i = 0; i < results.length; i++) {
            if (currentGroupId != results[i].groups_group_id) {
                currentGroupId = results[i].groups_group_id;
                fieldsArr.push({ "name": results[i].group_name + " commands", value: "" });
            }
            if (fieldsArr[currentGroupId - 1 + index].value.length + 32 + results[i].command_name.length + results[i].command_help.length + results[i].command_template.length >= 1024) {
                fieldsArr.push({ "name": results[i].group_name + " commands continued", "value": " " });
                index += 1;
            }
            let toAdd = "";
            if (results[i].needPerm) toAdd += "🛠️";
            toAdd += "\t***";
            toAdd += results[i].command_name;
            toAdd += "***:\n\t";
            toAdd += results[i].command_help;
            toAdd += "\t`";
            toAdd += prefix;
            toAdd += results[i].command_template;
            toAdd += "`\n";
            fieldsArr[currentGroupId - 1 + index].value += toAdd;
        }
        console.log(fieldsArr);
        embedTemplate.fields = [];
        embedTemplate.fields = fieldsArr;
        message.author.send({ "embed": embedTemplate });
    });
}

async function shuffleVoiceFunc(message, client, args, prefix, mysqlCon) {
    if (!message.member.hasPermission("ADMINISTRATOR") && !message.member.roles.cache.has(conf.discord.roles.administrator)) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
        return;
    }
    if (!args.includes('-m') || !args.includes('-c')) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough arguments", message.author.toString() + " you miss either the `-m` or `-c`.", message, client) });
        return;
    }
    let indexOfChannels;
    for (let i = 0; i < args.length; i++) {
        if (args[i] == '-c') indexOfChannels = i;
    }
    let channels = [];
    let members = [];
    let everyone = false;
    console.log(indexOfChannels);
    for (let i = indexOfChannels + 1; i < args.length; i++) {
        console.log(args[i] + " test");
        if (args[i] == '-m') break;
        let channelTest = message.guild.channels.cache.find(channel => channel.name == args[i]);
        if (channelTest == undefined || channelTest.type != 'voice') {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", message.author.toString() + " `" + args[i] + "` is not a valid voice channel.", message, client) });
            return;
        }
        channels.push(channelTest.id);
    }
    if (message.mentions.everyone) {
        everyone = true;
    }
    mentionedRoles = message.mentions.roles;
    mentionedMembers = message.mentions.members;
    if (everyone) {
        await message.guild.members.cache.forEach(member => {
            if (!member.user.bot) members.push(member.id);
        });

    }
    else {
        await mentionedRoles.forEach(async role => {
            await role.members.forEach(member => {
                if (!member.user.bot) members.push(member.id);
            });
        });
        await mentionedMembers.forEach(member => {
            if (!members.includes(member.id)) {
                if (!member.user.bot) members.push(member.id);
            }
        });
    }
    console.log(members);
    console.log(channels);
    members = await shuffle(members);
    console.log(members);
    for(let i = 0;i<members.length;i=i+channels.length) {
        console.log(i+" i");
        let j = i;
        for(let channelIndex = 0;channelIndex<channels.length;channelIndex++) {
            console.log(channelIndex+" channelIndex");
            let member = message.guild.members.cache.get(members[j]);
            console.log(member);
            member.voice.setChannel(message.guild.channels.cache.get(channels[channelIndex]));
            j++;
        }
    }

}
async function shuffle(a) {
    return new Promise(result => {
        var j, x, i;
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        result(a);
    });
}