var Discord = require('discord.js')
var config = require('./config')
var request = require('request')
var moment = require('moment')

function getGameData(gameID, cb) {
    var options = {
        url: `https://www.warzone.com/API/GameFeed?GameID=${gameID}`,
        method: 'POST',
        body: dataString
    }

    function callback(err, res, body) {
        if (!err && res.statusCode == 200) {
            console.log('POST successful')
            cb(null, JSON.parse(body))
        } else {
            console.log('POST failed ' + err)
            cb(err, JSON.parse(body))
        }
    }

    request(options, callback)
}

var gameIds = []
var oldGameData = []
var intervals = []
var notified = []
var timeSinceNotify = []

const API_DELAY = 45000
var dataString = `Email=${config.warzone.email}&APIToken=${config.warzone.token}`

var client = new Discord.Client()
client.login(config.discord.key)

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
    gameIds.forEach(function (gameId, i) {
        getGameData(gameId, function (err, data) {
            oldGameData[i] = data
        })
    })
})

client.on('message', msg => {
    if (msg.channel.id == config.discord.channel && !(msg.author.bot)) {
        console.log(msg.content)
        if (msg.content.substr(0, 8) == '!addgame') {
            var newGame = parseInt(msg.content.substr(8))
            console.log(newGame)
            getGameData(newGame, function (err, data) {
                console.log(err)
                console.log(data)
                if (err || "error" in data) {
                    client.channels.get(config.discord.channel).send(`Invalid game number: ${newGame}`)
                } else {
                    client.channels.get(config.discord.channel).send(`Added game "${data.name}"`)
                    oldGameData.push(data)
                    gameIds.push(newGame)
                    notified.push(false)
                    timeSinceNotify.push(moment - 1000 * 3600 * 8)
                    restart()
                }
            })
        }
    }
})

function dealWithGameData(i) {
    getGameData(gameIds[i], function (err, data) {
        if (err) return err
        if (!oldGameData[i]) {
            oldGameData[i] = data
        } else {
            if (data.numberOfTurns != oldGameData[i].numberOfTurns) {
                console.log('New turn')
                client.channels.get(config.discord.channel).send(`<@&384814450047189005> Turn ${data.numberOfTurns} has finished!`)
                timeSinceNotify[i] = moment()
                notified[i] = false
            }
            if (moment() - timeSinceNotify[i] > 1000 * 3600 * 8) {
                timeSinceNotify[i] = moment()
                data.players.forEach(function (element) {
                    if (element.hasCommittedOrders != 'True') {
                        console.log(`${element.name} being notified`)
                        var discName = config.warzoneToDiscord[element.name]
                        client.channels.get(config.discord.channel).send(`${discName}, please take your turn in ${data.name}`)
                    }
                })
            }
            var numLeft = [];
            data.players.forEach(function (element, index) {
                if (element.hasCommittedOrders == 'False') numLeft.push(element.name)
                if (element.hasCommittedOrders == 'True' && oldGameData[i].players[index].hasCommittedOrders != 'True' && element.isAI == 'False') {
                    console.log(`${element.name} has taken their turn in ${data.name}`)
                    client.channels.get(config.discord.channel).send(`${element.name} has taken their turn in ${data.name}`)
                }
            })
            if (numLeft.length == 1 && notified[i] == false) {
                client.channels.get(config.discord.channel).send(`${config.warzoneToDiscord[element.name]} is the only remaining player`)
                notified[i] = true
            }
            oldGameData[i] = data
        }
    })
}

function start(cb, i) {
    if (i >= gameIds.length) return
    else {
        intervals.push(setInterval(dealWithGameData, API_DELAY * gameIds.length, i))
        setTimeout(function () {
            cb(cb, i + 1)
        }, API_DELAY)
    }
}

function restart() {
    intervals.forEach(function (element, index) {
        clearInterval(element)
    })
    intervals.length = 0
    start(start, 0)
}