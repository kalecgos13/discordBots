const conf = require('../conf.json');
const mysql = require('mysql');
const randomColor = require('randomColor');
const standardEmbedMes = conf.discord.standardEmbedMes;
module.exports = {
    group: async function (funcName, message, client, args, prefix, mysqlCon) {
        switch (funcName) {
            case "createFunc":
                createFunc(message, args, mysqlCon, client);
                break;
            case "changeNameFunc":
                changeNameFunc(message, args, mysqlCon, client);
                break;
            case "changeColorFunc":
                changeColorFunc(message, args, mysqlCon, client);
                break;
            case "inviteFunc":
                inviteFunc(message, args, mysqlCon, client);
                break;
            case "kickFunc":
                kickFunc(message, args, mysqlCon, client);
                break;
            case "deleteFunc":
                deleteFunc(message, args, mysqlCon, client);
                break;
            case "changeLeaderFunc":
                changeLeaderFunc(message, args, mysqlCon, client);
                break;
            case "makeChannelFunc":
                makeChannelFunc(message, args, mysqlCon, client);
                break;
            case "deleteChannelFunc":
                deleteChannelFunc(message, args, mysqlCon, client);
                break;
            default:
                message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No such command", "No command found called `" + args[0] + "`\nType `" + prefix + "help` in order to view all commands", message, client) });
        }
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

async function createFunc(message, args, mysqlCon, client) {
    if (args.length < 2) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No name was given", message, client) });
        return;
    }
    let roleColor = null;
    let indexToStart = 1;
    if (args[1].charAt(0) == '#') {
        roleColor = args[1];
        indexToStart = 2;
    }
    let name = "";
    for (let i = indexToStart; i < args.length; i++) {
        name += args[i];
        name += " ";
    }
    name = name.substring(0, name.length - 1);
    let checkQuery = "select * from guild_groups where guilds_guild_discord_id = ? and group_name = ?";
    checkQuery = mysql.format(checkQuery, [message.guild.id, name]);
    mysqlCon.query(checkQuery, function (err, results) {
        if (err) throw err;
        if (results[0] != null) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Group already exists", "A group with `" + name + "` already exists.", message, client) });
            return;
        }
        else {
            mysqlCon.query("select max(group_id) as 'max' from guild_groups", async function (er, maxId) {
                if (er) throw er;
                let max = 0;
                if (maxId[0].max != null) max = maxId[0].max;
                let role = await message.guild.roles.create({
                    "data": {
                        "name": name,
                        "color": roleColor,
                        "mentionable": true
                    }
                });
                client.guilds.resolve(message.guild.id).members.resolve(message.author.id).roles.add(role);
                let insert = "insert into guild_groups values(" + (max + 1) + ",?,?,?,?,?)";
                insert = mysql.format(insert, [name, message.guild.id, role.id, roleColor, null]);
                mysqlCon.query(insert, function (error) {
                    if (error) throw error;
                    let insertMember = "insert into guild_group_members values(?,?,?,?,?)";
                    insertMember = mysql.format(insertMember, [message.author.id, 1, (max + 1), name, message.guild.id]);
                    mysqlCon.query(insertMember, function (error1) {
                        if (error1) throw error1;
                        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Group made", "Your group has been made.", message, client) });
                    });
                });
            });
        }
    });

}

async function changeNameFunc(message, args, mysqlCon, client) {
    console.log(message);
    if (args[1] == null) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No new name was given.", message, client) });
        return;
    }
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                if (error3) throw error3;
                roleId = roleId[0].role_id;
                let name = "";
                for (let i = 1; i < args.length; i++) {
                    name += args[i];
                    name += " ";
                }
                message.guild.roles.resolve(roleId).setName(name);
                let insert = "update guild_groups set group_name = ? where guilds_guild_discord_id = ? and group_id = ?";
                insert = mysql.format(insert, [name, message.guild.id, results[0].guild_groups_group_id]);
                mysqlCon.query(insert, function (error) {
                    if (error) throw error;
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Success", "Successfully changed the name of `" + results[0].guild_groups_group_name + "` to `" + name + "`.", message, client) });
                });
            });
        }
    });
}
async function changeColorFunc(message, args, mysqlCon, client) {
    if (args[1] == null) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No new role color was given.", message, client) });
        return;
    }
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        console.log(results);
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                if (error3) throw error3;
                roleId = roleId[0].role_id;
                message.guild.roles.resolve(roleId).setColor(args[1]);
                let insert = "update guild_groups set role_color = ? where guilds_guild_discord_id = ? and group_id = ?";
                insert = mysql.format(insert, [args[1], message.guild.id, results[0].guild_groups_group_id]);
                mysqlCon.query(insert, function (error) {
                    if (error) throw error;
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Success", "Successfully changed the role color.", message, client) });
                });
            });
        }
    });
}

async function inviteFunc(message, args, mysqlCon, client) {
    if (args[1] == null) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
        return;
    }
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                if (error3) throw error3;
                roleId = roleId[0].role_id;
                let mentioned = message.mentions.members.first();
                if (mentioned == null) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
                }
                else {
                    mysqlCon.query("select * from guild_group_members  where member_id = " + mentioned.user.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (error, resultsCheck) {
                        if (error) throw error;
                        if (resultsCheck[0] != null) {
                            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "Mentioned user is already in a group.", message, client) });
                        }
                        else {
                            mentioned.send({ "embed": generateStandardEmbed(standardEmbedMes, "You are invited!", "Hello " + mentioned.user.username + "\n\nYou have been invited to join `" + results[0].guild_groups_group_name + "` in the `" + message.guild.name + "` guild.\nUse the reaction emoji below to either accept or deny.", message, client) }).then(async mes => {
                                await mes.react('✅');
                                await mes.react('❎');
                                const filter = (reaction) => (reaction.emoji.name == '✅' || reaction.emoji.name == '❎');
                                const reactionCollector = mes.createReactionCollector(filter);
                                reactionCollector.on('collect', (reaction, user) => {
                                    if (reaction.emoji.name == '✅') {
                                        mes.delete().catch(console.error);
                                        mysqlCon.query("select * from guild_group_members where member_id = " + mentioned.user.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (error1, resultsCheck1) {
                                            if (error1) throw error1;
                                            if (resultsCheck1[0] != null) {
                                                mentioned.user.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "You already joined a group.", message, client) });
                                                message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Invitation denied", mentioned.user.username + " has denied your invitation.", message, client) });
                                            }
                                            else {
                                                mentioned.roles.add(roleId);
                                                let insertMember = "insert into guild_group_members values(?,0,?,?,?)";
                                                insertMember = mysql.format(insertMember, [mentioned.user.id, results[0].guild_groups_group_id, results[0].guild_groups_group_name, message.guild.id]);
                                                mysqlCon.query(insertMember, function (error2) {
                                                    if (error2) throw error2;
                                                    message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Invitation accepted", mentioned.user.username + " has accepted your invitation.", message, client) });
                                                });
                                            }
                                        });
                                    }
                                    else if (reaction.emoji.name == '❎') {
                                        mes.delete().catch(console.error);
                                        message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Invitation denied", mentioned.user.username + " has denied your invitation.", message, client) });
                                    }
                                });
                            });

                        }
                    });
                }
            });
        }
    });
}

async function kickFunc(message, args, mysqlCon, client) {
    if (args[1] == null) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
        return;
    }
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                if (error3) throw error3;
                roleId = roleId[0].role_id;
                let mentioned = message.mentions.members.first();
                if (mentioned == null) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
                }
                else if (mentioned.id == message.member.id) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "You can not kick yourself from your own group.", message, client) });
                }
                else {
                    mysqlCon.query("select * from guild_group_members where member_id = " + mentioned.user.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (error, resultsCheck) {
                        if (error) throw error;
                        if (resultsCheck[0] == null || resultsCheck[0].guild_groups_group_id != results[0].guild_groups_group_id) {
                            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "Mentioned user is not part of your group", message, client) });
                        }
                        else {
                            mentioned.roles.remove(roleId);
                            mysqlCon.query("delete from guild_group_members where member_id = " + mentioned.user.id + " and guild_groups_group_id = " + resultsCheck[0].guild_groups_group_id, function (error1) {
                                if (error1) throw error;
                            });
                        }
                    });
                }
            });
        }
    });
}

async function deleteFunc(message, args, mysqlCon, client) {
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Delete group", "Are you sure you wanna delete your group?\n Use ✅ to delete your group or ❎ to not delete your group.", message, client) }).then(async mes => {
                await mes.react('✅');
                await mes.react('❎');
                const filter = (reaction) => (reaction.emoji.name == '✅' || reaction.emoji.name == '❎');
                const reactionCollector = mes.createReactionCollector(filter);
                reactionCollector.on('collect', (reaction, user) => {
                    if (reaction.emoji.name == '✅') {
                        mes.delete().catch(console.error);
                        mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                            if (error3) throw error3;
                            roleId = roleId[0].role_id;
                            mysqlCon.query("delete from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error) {
                                if (error) throw error;
                                message.guild.roles.resolve(roleId).delete();
                                message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Success!", "Your group has been deleted.", message, client) });
                            });
                        });
                    }
                    else if (reaction.emoji.name == '❎') {
                        mes.delete().catch(console.error);
                    }
                });
            });
        }
    });
}

async function changeLeaderFunc(message, args, mysqlCon, client) {
    if (args[1] == null) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
        return;
    }
    mysqlCon.query("select * from guild_group_members where member_id = " + message.author.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (err, results) {
        if (err) throw error;
        if (results[0] == null || !results[0].isLeader) {
            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No group detected", "You are not part of a group or you are not the leader.", message, client) });
        }
        else {
            mysqlCon.query("select role_id from guild_groups where group_id = " + results[0].guild_groups_group_id, function (error3, roleId) {
                if (error3) throw error3;
                roleId = roleId[0].role_id;
                let mentioned = message.mentions.members.first();
                if (mentioned == null) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Missing parameter", "No mention was given.", message, client) });
                }
                else if (mentioned.id == message.member.id) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "You are already leader.", message, client) });
                }
                else {
                    mysqlCon.query("select * from guild_group_members where member_id = " + mentioned.user.id + " and guild_groups_guilds_guild_discord_id = " + message.guild.id, function (error, resultsCheck) {
                        if (error) throw error;
                        if (resultsCheck[0] == null || resultsCheck[0].guild_groups_group_id != results[0].guild_groups_group_id) {
                            message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Error", "Mentioned user is not part of your group.", message, client) });
                        }
                        else {
                            mysqlCon.query("update guild_group_members set isLeader = 1 where member_id = " + mentioned.user.id + " and guild_groups_group_id = " + results[0].guild_groups_group_id, function (errorUpdate1) {
                                if (errorUpdate1) throw errorUpdate1;
                                mysqlCon.query("update guild_group_members set isLeader = 0 where member_id = " + message.author.id + " and guild_groups_group_id = " + results[0].guild_groups_group_id, function (errorUpdate) {
                                    if (errorUpdate) throw errorUpdate;
                                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Success!", "Succesfully made " + mentioned.toString() + " the new leader of the group.", message, client) });
                                });
                            });
                        }
                    });
                }
            });
        }
    });
}
async function makeChannelFunc(message, args, mysqlCon, client) {
    if(!message.member.hasPermission("ADMINISTRATOR")) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
        return;
    }
    let groupCat = message.guild.channels.cache.find(channel => channel.name == "groups");
    if (groupCat == null) {
        await message.guild.channels.create('groups', {
            "type": "category",
            "permissionOverwrites":[{
                "id":message.guild.roles.everyone.id,
                "deny":['VIEW_CHANNEL']
            }]
        }).then(madeChannel => {
            groupCat = message.guild.channels.cache.find(channel => channel.name == "groups");
        });
    }
    let query = "select * from guild_groups where guilds_guild_discord_id = " + message.guild.id;
    if (args[1] != null) {
        query += " and group_name = ?";
        let name = "";
        console.log(args);
        for (let i = 1; i < args.length; i++) {
            name += args[i];
            name += " ";
        }
        name = name.substring(0, name.length - 1);
        query = mysql.format(query, [name]);
    }
    mysqlCon.query(query, function (err, results) {
        if (err) throw err;
        console.log(results);
        for (let i = 0; i < results.length; i++) {
            if (results[i].channel_id == null) {
                let groupName = results[i].group_name.replace(/ /gi, "_");
                console.log(groupName);
                message.guild.channels.create(groupName, {
                    "type": "text",
                    "topic": "A group for members of the `" + results[i].group_name + "` group"
                }).then(async createdChannel => {
                    console.log(createdChannel.name);
                    mysqlCon.query("update guild_groups set channel_id = " + createdChannel.id + " where group_id = " + results[i].group_id, function (er) {
                        if (er) throw er;
                    });
                    await createdChannel.setParent(message.guild.channels.cache.find(channel => channel.name == "groups"), {"lockPermissions":true});
                    await createdChannel.overwritePermissions([{
                        "id": results[i].role_id,
                        "allow":['ADD_REACTIONS','VIEW_CHANNEL','SEND_MESSAGES','SEND_TTS_MESSAGES','EMBED_LINKS','ATTACH_FILES','READ_MESSAGE_HISTORY','MENTION_EVERYONE','USE_EXTERNAL_EMOJIS']
                    },{
                        "id":message.guild.roles.everyone.id,
                        "deny":['VIEW_CHANNEL']
                    }]);
                });
            }
        }
    });
}
async function deleteChannelFunc(message, args, mysqlCon, client) {
    if(!message.member.hasPermission("ADMINISTRATOR")) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
        return;
    }
    let query = "select channel_id, group_id from guild_groups where guilds_guild_discord_id = " + message.guild.id;
    if (args[1] != null) {
        query += " and group_name = ?";
        let name = "";
        console.log(args);
        for (let i = 1; i < args.length; i++) {
            name += args[i];
            name += " ";
        }
        name = name.substring(0, name.length - 1);
        query = mysql.format(query, [name]);
    }
    console.log(query);
    mysqlCon.query(query, function(err, results){
        if(err) throw err;
        for(let i = 0;i<results.length;i++) {
            message.guild.channels.resolve(results[i].channel_id).delete();
            mysqlCon.query("update guild_groups set channel_id = null where group_id = "+results[i].group_id, function(error){
                if(error) throw error;
            });
        }
    });
}