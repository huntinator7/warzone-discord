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

const GAME_ID = 14501144

var oldGameData
var timeSinceNotify = moment().add(1, 'days').calendar()
var dataString = `Email=${config.warzone.email}&APIToken=${config.warzone.token}`

var client = new Discord.Client()
client.login(config.discord.key)

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
    getGameData(GAME_ID, function (err, data) {
        oldGameData = data
    })
})

client.on('message', msg => {
    if (msg.channel.id == config.discord.channel && !(msg.author.bot)) {
        console.log(msg.content)
    }
})

function dealWithGameData() {
    getGameData(GAME_ID, function (err, data) {
        if (err) return err
        if (!oldGameData) {
            oldGameData = data
        } else {
            if (data.numberOfTurns != oldGameData.numberOfTurns) {
                console.log('New turn')
                client.channels.get(config.discord.channel).send(`<@&384814450047189005> Turn ${data.numberOfTurns} has finished!`)
                timeSinceNotify = moment()
            }
            if (timeSinceNotify - moment() > 1000*43200) {
                timeSinceNotify = moment()
                data.players.forEach(function (element, index) {
                    if (element.hasCommittedOrders != 'True') {
                        console.log(`${element.name} being notified`)
                        var discName = config.warzoneToDiscord[element.name]
                        client.channels.get(config.discord.channel).send(`${discName}, please take your turn`)
                    }
                })
            }
            data.players.forEach(function (element, index) {
                if (element.hasCommittedOrders == 'True' && oldGameData.players[index].hasCommittedOrders != 'True') {
                    console.log(`${element.name} has taken their turn`)
                    client.channels.get(config.discord.channel).send(`${element.name} has taken their turn`)
                }
            })
            oldGameData = data
        }
    })
}

setInterval(dealWithGameData, 60000)