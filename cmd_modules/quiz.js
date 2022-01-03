const conf = require('../conf.json');
const mysql = require('mysql');
const Excel = require('exceljs');
const fs = require('fs');
const https = require('https')
const randomColor = require('randomcolor');
const standardEmbedMes = conf.discord.standardEmbedMes;
module.exports = {
    quiz: async function (funcName, message, client, args, prefix, mysqlCon) {
        eval(funcName + "(message,client,args, prefix, mysqlCon)");
        //message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "No such quiz command", "No quiz command found called `" + args[0] + "`\nType `" + prefix + "help` in order to view all commands", message, client) });
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

async function addQuestionDMFunc(message, client, args, prefix, mysqlCon) {
    if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client)] });
        return;
    }
    previewEmbed = { "embeds": [generateStandardEmbed(standardEmbedMes, "(PREVIEW) Question X", "", message, client)] };
    let previewMes = null;
    await message.author.send(previewEmbed).then(async mes => {
        previewMes = mes;
    });
    let responseMes = null;
    let section = 'QUESTION'
    await message.author.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Add a question", "Typ the question and press enter.\nType `quit` to stop creating a question and `back` to move back to the previous section.\n(You have 60 seconds for each section)", message, client)] }).then(async mes => {
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
                await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by `;` and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client)] });
                break;
            case 'ANSWERS':
                if (receivedMes.content == 'back') {
                    section = 'QUESTION';
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Add a question", "Typ the question and press enter.\nType `quit` to stop creating a question and `back` to move back to the previous section.\n(You have 60 seconds for each section)", message, client) ]});
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
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client)] });
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
                        await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Select the correct answer", "Typ the letter that corresponds to the correct answer for this question.\n\n**NOTE** The correct answer will be in italic in the preview, this will **NOT** show during the actual quiz.", message, client) ]});
                        section = 'CORRECT';
                    }

                }
                break;
            case 'CORRECT':
                if (receivedMes.content == 'back') {
                    section = 'ANSWERS';
                    console.log("backing from correct");
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by `;` and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client)] });
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
                await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client) ]});
                section = 'POINTS';
                break;
            case 'POINTS':
                if (receivedMes.content == 'back') {
                    if (answers == null) {
                        section = 'ANSWERS';
                        await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Add the answers", "Typ the given answers for this question (seperate by space and there is a limit to **6** answers).\nIf this is an open question, type `null`.", message, client) ]});
                    }
                    else {
                        section = 'CORRECT';
                        await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Select the correct answer", "Typ the letter that corresponds to the correct answer for this question.\n\n**NOTE** The correct answer will be in italic in the preview, this will **NOT** show during the actual quiz.", message, client)] });
                    }
                    break;
                }
                if (Number.isNaN(+receivedMes.content)) break;
                points = +receivedMes.content;
                previewEmbed.embed.title = "(PREVIEW) Question X (" + points + " Point(s))";
                await previewMes.edit(previewEmbed);
                section = 'TIME';
                await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of time given", "Typ the amount of time (in seconds) given for this question", message, client) ]});
                break;
            case 'TIME':
                if (receivedMes.content == 'back') {
                    section = 'POINTS';
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of points", "Typ the amount of points this question can give.", message, client)] });
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
                await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of time before next question", "Typ the amount of time (in seconds) before the next question is given.\n\n**NOTE**The time will be shown in the preview, but this will **NOT** be shown during the actual quiz.", message, client) ]});
                section = 'TIMEBEFORENEXT';
                break;
            case 'TIMEBEFORENEXT':
                if (receivedMes.content == 'back') {
                    section = 'TIME';
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of time given", "Typ the amount of time (in seconds) given for this question", message, client) ]});
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
                await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Checking", "Check the preview to see if everything is correct.\nIf so, type `yes` to add the question.", message, client)] });
                break;
            case 'CHECK':
                if (receivedMes.content == 'back') {
                    section = 'TIMEBEFORENEXT';
                    await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Amount of time before next question", "Typ the amount of time (in seconds) before the next question is given.\n\n**NOTE**The time will be shown in the preview, but this will **NOT** be shown during the actual quiz.", message, client) ]});
                    break;
                }
                if (receivedMes.content != 'yes') break;
                console.log(question, answers, correctIndex, points, time, timeBeforeNext, answerString);
                mysqlCon.query("select * from seq_1_to_200 where seq not in (select guild_question_id from quiz_questions) limit 1", function (error, results) {
                    if (error) throw error;
                    let query = 'insert into quiz_questions(question,answers,amount_of_points,time,time_before_next,correct_answer,guilds_guild_discord_id,guild_question_id) values (?,?,?,?,?,?,?,?)';
                    query = mysql.format(query, [question, answerString, points, time, timeBeforeNext, correctIndex, message.guild.id, results[0].seq]);
                    mysqlCon.query(query, async function (err) {
                        if (err) throw err;
                        section = 'LAST';
                        await responseMes.edit({ "embeds": [generateStandardEmbed(standardEmbedMes, "Success", "Successfully added the question\nTyp `start` to add another question or anything else to quit (or wait 60 seconds and it will quit by itself).", message, client) ]});
                    });
                });
                break;
            case 'LAST':
                finished = true;
                await responseMes.delete().catch(console.error);
                await previewMes.delete().catch(console.error);
                if (receivedMes.content == 'start') addQuestionFunc(message, client, args, prefix, mysqlCon);
                break;
        }
    }

}
async function exportFunc(message, client, args, prefix, mysqlCon) {
    if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client) ]});
        return;
    }
    let workbook = await getQuestions(message, mysqlCon);

    await workbook.xlsx.writeFile('questions' + message.author.id + '.xlsx');
    await message.author.send({ files: ['questions' + message.author.id + '.xlsx'] });
    fs.unlinkSync('questions' + message.author.id + '.xlsx');
}

async function addQuestionFunc(message, client, args, prefix, mysqlCon) {
    if (!message.member.roles.cache.has(conf.discord.roles.quizMaster)) {
        message.channel.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Not enough permissions", message.author.toString() + " you do not have the right role to use this command!", message, client)] });
        return;
    }
    const filter = response => {
        return true;
    }
    let sentMessage = null;
    await message.author.send({ files: ['./files/quizQuestionsTemplate.xlsx'], "embeds": [generateStandardEmbed(standardEmbedMes, "Adding a question", "Use this template (see attached file) to add questions.\n You have 60 seconds to attach the xlsx file with the questions to a message in this DM (You can also call the command again to attach it if you are not fast enough).\n\nKeep in mind, any questions that you already have in the database will be overwritten by this xlsx file.\nSo if you already have questions, use `" + prefix + "quiz exportToExcel` to get the xlsx filled with the questions.\nYou can then use that xlsx file to modify the questions.", message, client)] }).then(mes => {
        sentMessage = mes;
    });
    let receivedMes = null;
    await sentMessage.channel.awaitMessages(filter, { max: 1, time: 60000, errors: ['time'] }).then(async mes => {
        receivedMes = mes.first();
    }).catch(async mes => {
        console.log("delete");
        await sentMessage.delete().catch(console.error);
        finished = true;
    });
    console.log(receivedMes.content);
    if (receivedMes.attachments.first() == null) {
        console.log(null);
        sentMessage.delete().catch(console.error);
        return;
    }
    try {
        https.get(receivedMes.attachments.first().url, resp => {
            resp.pipe(fs.createWriteStream('./files/' + receivedMes.author.id + receivedMes.attachments.first().name));
            console.log("done");
            addQuestionsFromExcel(message, receivedMes, './files/' + receivedMes.author.id + receivedMes.attachments.first().name, client, mysqlCon);
        });
    }
    catch (error) {
        console.log(error);
    }
    sentMessage.delete().catch(console.error);
}
async function addQuestionsFromExcel(message, receivedMes, fileName, client, mysqlCon) {
    try {
        if (!fileName.endsWith('.xlsx')) throw new CustomError("File is not an `.xlsx` file.");
        let workbook = new Excel.Workbook();
        await workbook.xlsx.readFile(fileName);
        let worksheet = workbook.getWorksheet('questions');
        if (worksheet == null) throw new CustomError("File does not have a `questions` sheet");
        console.log(worksheet.rowCount);
        let allQuestions = [];
        await worksheet.eachRow(function (row, rowNumber) {
            if (rowNumber != 1) {
                let cells = row._cells;
                row = [];
                for (let i = 0; i < cells.length; i++) {
                    try {
                        let value = cells[i]._value.model.value
                        if (value == undefined) value = null;
                        row.push(value);
                    }
                    catch (error) {
                        if (error instanceof TypeError) {
                            row.push(null);
                        }
                        else {
                            throw error;
                        }
                    }
                }
                console.log(row);
                let id, question, answers, correctAnswer, points, time, timeBefore = null;
                id = row[0];
                if (id == null || Number.isNaN(+id)) throw new CustomError("The ID of row `" + rowNumber + "` is not a number or is empty");
                id = +id;
                if (id >= 0) {
                    question = row[1];
                    answers = row[2];
                    if (answers != null && (answers.match(/;/g) || []).length > 5) throw new CustomError("The amount of answers in row `" + rowNumber + "` is larger then 6");
                    let answerAmount = null;
                    if (answers != null) answerAmount = answers.split(';').length;
                    correctAnswer = row[3];
                    if (answers == null && correctAnswer != null) throw new CustomError("The correct answer index is not empty at row `" + rowNumber + "` when it is an open question");
                    if (answers != null) {
                        if (correctAnswer == null || Number.isNaN(+correctAnswer)) throw new CustomError("The correct answer index of row `" + rowNumber + "` is not a number or is empty");
                        correctAnswer = +correctAnswer;
                        if (correctAnswer != null && correctAnswer >= answerAmount) throw new CustomError("The correct answer index is not in range at row `" + rowNumber + "`");
                    }
                    points = row[4];
                    if (points == null || Number.isNaN(+points)) throw new CustomError("The points of row `" + rowNumber + "` is not a number or is empty");
                    points = +points;
                    time = row[5];
                    if (time == null || Number.isNaN(+time)) throw new CustomError("The time given of row `" + rowNumber + "` is not a number or is empty");
                    time = +time;
                    timeBefore = row[6];
                    if (timeBefore == null || Number.isNaN(+timeBefore)) throw new CustomError("The time before next question of row `" + rowNumber + "` is not a number or is empty");
                    timeBefore = +timeBefore;
                    console.log(id, question, answers, correctAnswer, points, time, timeBefore);
                    allQuestions.push([id, question, answers, correctAnswer, points, time, timeBefore, message.guild.id]);
                }
            }
        });
        console.log(allQuestions.length);
        mysqlCon.query("delete from quiz_questions where guilds_guild_discord_id = " + message.guild.id, function (err) {
            if (err) throw err;
            for (let i = 0; i < allQuestions.length; i++) {
                let questionObj = allQuestions[i];
                let query = "insert into quiz_questions(guild_question_id,question,answers,correct_answer, amount_of_points,time,time_before_next,guilds_guild_discord_id) values (?,?,?,?,?,?,?,?)";
                query = mysql.format(query, questionObj);
                mysqlCon.query(query, function (error1) {
                    if (error1) throw error1;
                });
            }
            message.author.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Success!", "Added " + allQuestions.length + " questions!", message, client) ]});
        });
    }
    catch (error) {
        if (error instanceof CustomError) {
            console.log(error.message);
            message.author.send({ "embeds": [generateStandardEmbed(standardEmbedMes, "Error", error.message, message, client)] });
        }
        else throw error;
    }
    finally {
        fs.unlinkSync(fileName);
    }
}
function getQuestions(message, mysqlCon) {
    return new Promise(res => {
        mysqlCon.query('select * from quiz_questions where guilds_guild_discord_id = ' + message.guild.id + ' order by guild_question_id', async function (err, results) {
            if (err) throw err;
            let workbook = new Excel.Workbook()
            let worksheet = workbook.addWorksheet('questions');
            worksheet.columns = [
                { header: 'id', key: 'guild_question_id', width: 10 },
                { header: 'question', key: 'question', width: 100 },
                { header: 'answers', key: 'answers', width: 50 },
                { header: 'correct answer index', key: 'correct_answer', width: 20 },
                { header: 'points', key: 'amount_of_points', width: 10 },
                { header: 'time given (s)', key: 'time', width: 15 },
                { header: 'time before next question (s)', key: 'time_before_next', width: 25 }
            ];
            for (let i = 0; i < results.length; i++) {
                const rowIndex = i + 2;
                let row = worksheet.getRow(rowIndex);
                row.values = results[i];
                row.commit();
            }
            res(workbook);
        });
    });
}

class CustomError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}