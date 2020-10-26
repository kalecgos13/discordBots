const conf = require('../conf.json');
const mysql = require('mysql');
const randomColor = require('randomColor');
const standardEmbedMes = conf.discord.standardEmbedMes;
const standardQuizMes = conf.discord.standardQuizMes;
module.exports = {
    quiz: async function (funcName, message, client, args, prefix, mysqlCon) {
        switch (args[0]) {
            case 'addQuestion':
                if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
                    break;
                }
                var question = args[1];
                if (isNaN(args[2])) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Invalid input", message.author.toString() + " `" + args[2] + "` is not a valid number!", message, client) });
                    break;
                }
                let amountOfSeconds = parseInt(args[2]);
                if (isNaN(args[3])) {
                    message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Invalid input", message.author.toString() + " `" + args[3] + "` is not a valid number!", message, client) });
                    break;
                }
                let amountOfPoints = parseInt(args[3]);
                let correctAnswer = null, possibleAnswers = null, attachmentUrl = null;
                if (args.length >= 4) {
                    if (args[4] != "null") correctAnswer = args[4];
                    if (args.length >= 5) possibleAnswers = "";
                    for (let i = 5; i < args.length; i++) {
                        possibleAnswers += args[i];
                        possibleAnswers += ",";
                    }
                    possibleAnswers = possibleAnswers.substring(0, possibleAnswers.length - 1);
                }
                if(message.att)
                console.log(question, amountOfSeconds, amountOfPoints, correctAnswer, possibleAnswers);
                let quizEmbed = JSON.parse(JSON.stringify(standardQuizMes));
                quizEmbed.embed.description = "**" + question + "**";
                if (message.attachments.first() != null) {
                    console.log("url "+message.attachments.first().url);
                    attachmentUrl = message.attachments.first().url;
                    quizEmbed.embed.image.url = message.attachments.first().url;
                }
                quizEmbed.embed.color = parseInt(randomColor().substring(1), 16);
                quizEmbed.embed.timestamp = (new Date(Date.now() - (new Date()).getTimezoneOffset() * 60000).toISOString().slice(0, -1));
                quizEmbed.embed.footer.icon_url = client.guilds.resolve(message.guild.id).members.resolve(client.user.id).user.avatarURL();
                quizEmbed.embed.footer.text = client.user.username;
                quizEmbed.embed.author.name = message.author.username;
                quizEmbed.embed.author.icon_url = client.guilds.resolve(message.guild.id).members.resolve(message.author.id).user.avatarURL();
                if (possibleAnswers != null) {
                    let answerArr = possibleAnswers.split(",");
                    for (let i = 0; i < answerArr.length; i++) {
                        quizEmbed.embed.fields[i] = {
                            "name": String.fromCharCode(i + 65),
                            "value": answerArr[i],
                            "inline": true
                        }
                    }
                }
                message.channel.send(quizEmbed).then(async mes => {
                    await mes.react('✅');
                    await mes.react('❎');
                    const filter = (reaction) => (reaction.emoji.name == '✅' || reaction.emoji.name == '❎');
                    const reactionCollector = mes.createReactionCollector(filter);
                    reactionCollector.on('collect', (reaction, user) => {
                        user = client.guilds.resolve(message.guild.id).members.resolve(user.id);
                        console.log(user);
                        if (user.roles.cache.has(conf.discord.roles.quizMaster)) {
                            if (reaction.emoji.name == '✅') {
                                mes.delete().catch(console.log.error);
                                message.channel.send("Added the question");
                                let insertQuery = "insert into quiz_questions(question,time,amount_of_points,correct_answer,answers,attachment_path) values(?,?,?,?,?,?)";
                                console.log("url: "+attachmentUrl);
                                let inserts = [question,amountOfSeconds,amountOfPoints,correctAnswer,possibleAnswers,attachmentUrl];
                                insertQuery = mysql.format(insertQuery,inserts);
                                mysqlCon.query(insertQuery, function(err) {
                                    if(err) throw err;
                                });
                            }
                            else if (reaction.emoji.name == '❎') {
                                mes.delete().catch(console.log.error);
                                message.channel.send("Discard the question");
                            }
                        }
                    });
                });
                break;
            default:
                message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "No such quiz command", "No quiz command found called `" + args[0] + "`\nType `" + prefix + "help` in order to view all commands", message, client) });
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