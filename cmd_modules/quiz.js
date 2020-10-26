const conf = require('../conf.json');
const mysql = require('mysql');
const Excel = require('exceljs');
const fs = require('fs');
const randomColor = require('randomcolor');
const standardEmbedMes = conf.discord.standardEmbedMes;
const standardQuizMes = conf.discord.standardQuizMes;
module.exports = {
    quiz: async function (funcName, message, client, args, prefix, mysqlCon) {
        switch (funcName) {
            case 'addQuestionFunc':
                addQuestionFunc(message, client, args, mysqlCon);
                break;
            case 'exportFunc':
                exportFunc(message,client, args, mysqlCon);
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

async function addQuestionFunc(message, client, args, mysqlCon) {
    if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
        return;
    }
    previewEmbed = { "embed": generateStandardEmbed(standardEmbedMes, "(PREVIEW) Question X", "", message, client) };
    let previewMes = null;
    await message.author.send(previewEmbed).then(async mes => {
        previewMes = mes;
    });
    let responseMes = null;
    let section = 'QUESTION'
    await message.author.send({ "embed": generateStandardEmbed(standardEmbedMes, "Add a question", "Typ the question and press enter.\nType `quit` to stop creating a question and `back` to move back to the previous section.\n(You have 60 seconds for each section)", message, client) }).then(async mes => {
        responseMes = mes;
    });
    const filter = response => {
        return true;
    }
    let finished = false;
    let question = null;
    let answers = null;
    let answerString = null;
    let correctIndex = null;
    let points = null;
    let time = null;
    let timeBeforeNext = null;
    previewEmbed.embed.fields = [];
    while (!finished) {
        let receivedMes = null;
        await responseMes.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).then(async mes => {
            receivedMes = mes.first();
        }).catch(async mes => {
            console.log("delete");
            await previewMes.delete().catch(console.error);
            await responseMes.delete().catch(console.error);
            finished = true;
        });
        console.log(receivedMes.content);
        if (receivedMes.content == 'quit') {
            await previewMes.delete().catch(console.error);
            await responseMes.delete().catch(console.error);
            finished = true;
            break;
        }
        console.log(section);
        switch (section) {
            case 'QUESTION':
                if (receivedMes.content == 'back') break;
                question = receivedMes.content;
                previewEmbed.embed.description = "**" + question + "**";
                await previewMes.edit(previewEmbed);
                section = 'ANSWERS';
                await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by `;` and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client) });
                break;
            case 'ANSWERS':
                if (receivedMes.content == 'back') {
                    section = 'QUESTION';
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Add a question", "Typ the question and press enter.\nType `quit` to stop creating a question and `back` to move back to the previous section.\n(You have 60 seconds for each section)", message, client) });
                    break;
                }
                if (receivedMes.content != 'null') {
                    answers = receivedMes.content.split(';');
                    answerString = receivedMes.content;
                }
                else answers = null;
                if (answers == null) {
                    correctIndex = null;
                    previewEmbed.embed.fields[0] = {
                        name: "This is an open question.",
                        value: "The group leader has to typ the answer in the chat."
                    }
                    await previewMes.edit(previewEmbed);
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client) });
                    section = 'POINTS';
                }
                else {
                    if (answers.length <= 6) {
                        previewEmbed.embed.fields = [];
                        for (let i = 0; i < answers.length; i++) {
                            previewEmbed.embed.fields[i] = {
                                name: String.fromCharCode(i + 65),
                                value: answers[i],
                                inline: true
                            }
                        }
                        await previewMes.edit(previewEmbed);
                        await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Select the correct answer", "Typ the letter that corresponds to the correct answer for this question.\n\n**NOTE** The correct answer will be in italic in the preview, this will **NOT** show during the actual quiz.", message, client) });
                        section = 'CORRECT';
                    }

                }
                break;
            case 'CORRECT':
                if (receivedMes.content == 'back') {
                    section = 'ANSWERS';
                    console.log("backing from correct");
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by `;` and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client) });
                    break;
                }
                if (receivedMes.content.length != 1) break;
                if (receivedMes.content.toUpperCase().charCodeAt(0) - 65 < 0 || receivedMes.content.toUpperCase().charCodeAt(0) - 65 >= answers.length) break;
                correctIndex = receivedMes.content.toUpperCase().charCodeAt(0) - 65;
                console.log(correctIndex);
                for (let i = 0; i < answers.length; i++) {
                    if (i == correctIndex) previewEmbed.embed.fields[i].value = "*" + answers[i] + "*";
                    else previewEmbed.embed.fields[i].value = answers[i];
                }
                await previewMes.edit(previewEmbed);
                await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client) });
                section = 'POINTS';
                break;
            case 'POINTS':
                if (receivedMes.content == 'back') {
                    if (answers == null) {
                        section = 'ANSWERS';
                        await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by space and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client) });
                    }
                    else {
                        section = 'CORRECT';
                        await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Select the correct answer", "Typ the letter that corresponds to the correct answer for this question.\n\n**NOTE** The correct answer will be in italic in the preview, this will **NOT** show during the actual quiz.", message, client) });
                    }
                    break;
                }
                if (Number.isNaN(+receivedMes.content)) break;
                points = +receivedMes.content;
                previewEmbed.embed.title = "(PREVIEW) Question X (" + points + " Point(s))";
                await previewMes.edit(previewEmbed);
                section = 'TIME';
                await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of time given", "Typ the amount of time (in seconds) given for this question", message, client) });
                break;
            case 'TIME':
                if (receivedMes.content == 'back') {
                    section = 'POINTS';
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client) });
                    break;
                }
                if (Number.isNaN(+receivedMes.content)) break;
                time = +receivedMes.content;
                let indexOfField = 0;
                if (answers != null) indexOfField = answers.length;
                previewEmbed.embed.fields[indexOfField] = {
                    name: "Time:",
                    value: time + " Second(s)"
                };
                await previewMes.edit(previewEmbed);
                await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of time before next question", "Typ the amount of time (in seconds) before the next question is given.\n\n**NOTE**The time will be shown in the preview, but this will **NOT** be shown during the actual quiz.", message, client) });
                section = 'TIMEBEFORENEXT';
                break;
            case 'TIMEBEFORENEXT':
                if (receivedMes.content == 'back') {
                    section = 'TIME';
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of time given", "Typ the amount of time (in seconds) given for this question", message, client) });
                    break;
                }
                if (Number.isNaN(+receivedMes.content)) break;
                timeBeforeNext = +receivedMes.content;
                let indexOfFieldTime = 1;
                if (answers != null) indexOfFieldTime = answers.length + 1;
                previewEmbed.embed.fields[indexOfFieldTime] = {
                    name: "Time before next question:",
                    value: timeBeforeNext + " Second(s)"
                };
                await previewMes.edit(previewEmbed);
                section = 'CHECK';
                await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Checking", "Check the preview to see if everything is correct.\nIf so, type `yes` to add the question.", message, client) });
                break;
            case 'CHECK':
                if (receivedMes.content == 'back') {
                    section = 'TIMEBEFORENEXT';
                    await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Amount of time before next question", "Typ the amount of time (in seconds) before the next question is given.\n\n**NOTE**The time will be shown in the preview, but this will **NOT** be shown during the actual quiz.", message, client) });
                    break;
                }
                if (receivedMes.content != 'yes') break;
                console.log(question, answers, correctIndex, points, time, timeBeforeNext, answerString);
                mysqlCon.query("select * from seq_1_to_200 where seq not in (select guild_question_id from quiz_questions) limit 1", function (error, results) {
                    if(error) throw error;
                    let query = 'insert into quiz_questions(question,answers,amount_of_points,time,time_before_next,correct_answer,guilds_guild_discord_id,guild_question_id) values (?,?,?,?,?,?,?,?)';
                    query = mysql.format(query, [question, answerString, points, time, timeBeforeNext, correctIndex, message.guild.id,results[0].seq]);
                    mysqlCon.query(query, async function (err) {
                        if (err) throw err;
                        section = 'LAST';
                        await responseMes.edit({ "embed": generateStandardEmbed(standardEmbedMes, "Success", "Successfully added the question\nTyp `start` to add another question or anything else to quit (or wait 60 seconds and it will quit by itself).", message, client) });
                    });
                });
                break;
            case 'LAST':
                finished = true;
                await responseMes.delete().catch(console.error);
                await previewMes.delete().catch(console.error);
                if (receivedMes.content == 'start') addQuestionFunc(message, client, args, mysqlCon);
                break;
        }
    }

}
async function exportFunc(message, client, args, mysqlCon) {
    if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
        message.channel.send({ "embed": generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) });
        return;
    }
    mysqlCon.query('select * from quiz_questions where guilds_guild_discord_id = '+message.guild.id+' order by guild_question_id', async function(err, results) {
        if(err) throw err;
        let workbook = new Excel.Workbook()
        let worksheet = workbook.addWorksheet('questions');
        worksheet.columns = [
            {header:'id', key: 'guild_question_id', width: 10},
            {header: 'question', key: 'question', width: 100},
            {header: 'answers', key :'answers', width: 50},
            {header: 'correct answer index', key: 'correct_answer', width:10},
            {header: 'points', key:'amount_of_points', width:10},
            {header:'time given', key:'time', width:10},
            {header: 'time before next', key:'time_before_next',width:10}
        ];
        for(let i = 0;i<results.length;i++) {
            const rowIndex = i+2;
            let row = worksheet.getRow(rowIndex);
            row.values= results[i];
            row.commit();
        }
        await workbook.csv.writeFile('questions'+message.author.id+'.csv');
        await message.author.send("test", {files:['questions'+message.author.id+'.csv']});
        fs.unlinkSync('questions'+message.author.id+'.csv');
    });
}