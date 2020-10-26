const conf = require('../conf.json');
const randomColor = require('randomColor');
const standardEmbedMes = conf.discord.standardEmbedMes;
module.exports = {
    main: async function(funcName, message, client, args, prefix, mysqlCon) {
            switch(funcName) {
                case "pingFunc":
                    pingFunc(message,client,args);
                    break;
                case "helpFunc":
                    helpFunc(message,client,args, prefix, mysqlCon);
                    break;
                default:
                    message.channel.send({"embed":generateStandardEmbed(standardEmbedMes,"No such command", "No command found called `"+args[0]+"`\nType `"+prefix+"help` in order to view all commands", message, client)});
            }
    }
}

function generateStandardEmbed(standard,title,description,message, client) {
    let embed = standard.embed;
    embed.title = title;
    embed.description = description;
    embed.color = parseInt(randomColor().substring(1),16);
    embed.timestamp = (new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, -1));
    embed.footer.icon_url = client.guilds.resolve(message.guild.id).members.resolve(client.user.id).user.avatarURL();
    embed.footer.text = client.user.username;
    embed.author.name = message.author.username;
    embed.author.icon_url =  client.guilds.resolve(message.guild.id).members.resolve(message.author.id).user.avatarURL();
    return JSON.parse(JSON.stringify(embed));
}

async function pingFunc(message, client, args) {
    message.channel.send({"embed":generateStandardEmbed(standardEmbedMes,"Ping command", "Pong!\nLatency is `"+(Date.now() - message.createdTimestamp)+"ms`\nAPI Latency is `"+(Math.round(client.ws.ping))+"ms`", message, client)});
}
async function helpFunc(message, client, args, prefix, mysqlCon) {
    let embedTemplate = generateStandardEmbed(standardEmbedMes, "Help command", "Here is a list of all available commands sorted by groups\n**NOTE: a 🛠️ infront of a command means that only certain roles can use it.**\n\nServer prefix =`"+prefix+"`.",message,client);
    mysqlCon.query("select * from commands join groups on groups_group_id = group_id order by groups_group_id", function(err, results) {
        if(err) throw err;
        let fieldsArr = [];
        let currentGroupId = -1;
        console.log(results);
        let index = 0;
        for(let i = 0;i<results.length;i++) {
            if(currentGroupId != results[i].groups_group_id) {
                currentGroupId = results[i].groups_group_id;
                fieldsArr.push({"name":results[i].group_name+" commands", value:""});
            }
            if(fieldsArr[currentGroupId-1+index].value.length + 32 + results[i].command_name.length+results[i].command_help.length+results[i].command_template.length >= 1024) {
                fieldsArr.push({"name":results[i].group_name+" commands continued","value":" "});
                index+=1;
            }
            let toAdd = "";
            if(results[i].needPerm) toAdd+="🛠️";
            toAdd+="\t***";
            toAdd+=results[i].command_name;
            toAdd+="***:\n\t";
            toAdd+=results[i].command_help;
            toAdd+="\t`";
            toAdd+=prefix;
            toAdd+=results[i].command_template;
            toAdd+="`\n";
            fieldsArr[currentGroupId-1+index].value+=toAdd; 
        }
        console.log(fieldsArr);
        embedTemplate.fields = [];
        embedTemplate.fields = fieldsArr;
        message.author.send({"embed":embedTemplate});  
    });
}