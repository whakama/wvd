const fs = require('fs')
const crypto = require('crypto')
const cp = require('child_process')
const os = require('os')

var arch = os.arch().replace('x64', 'amd64')
if(arch !== 'x86' && arch !== 'amd64') return console.log(`your computer's architecture (${arch}) is not supported by wvd`)

var commands = {
    '--fetch': fetchWineVersions,
    '--download': downloadWine,
    '--search': searchWineVersions,
    '--help': helpCommand
}

var command;
var commandArg;

for (let i = 0; i < process.argv.length; i++) {
    if(process.argv[i].startsWith('--')) {
        command = process.argv[i]
        commandArg = process.argv.slice(i+1).join(' ')
        break;
    }
}

var wineVersions;
var tempDirPath;

async function load() {
    if(!fs.existsSync('./downloads')) fs.mkdirSync('./downloads')
    tempDirPath = `/tmp/wvd`
    if(!fs.existsSync(tempDirPath)) fs.mkdirSync(tempDirPath) //tmp dir for downloaded tars
    wineVersions = fs.existsSync(`${tempDirPath}/versions.json`) ? JSON.parse(fs.readFileSync(`${tempDirPath}/versions.json`).toString()) : await fetchWineVersions()

    if(commands[command]) {
        commands[command](commandArg) //readable code :)
    } else {
        helpCommand()
    }
}


function helpCommand() {
    console.log('usage:\n\nwvd --fetch: re-fetches wine version list cache (which is cleared at every startup anyways)\nwvd --search (args): lets you search for wine versions\nwvd --download (args): lets you download any of the versions in the list\nwvd --help: man you know what it does')
}

async function fetchWineVersions(force) { //force does the exact opposite of what youd expect
    if(fs.existsSync(`${tempDirPath}/versions.json`) && force) return wineVersions;

    console.log(`fetching wine version list... ${force ? '(this only happens every restart)' : ''}`)
    var wineVersions = await (await fetch('https://phoenicis.playonlinux.com/index.php/wine?os=linux')).json()

    var wineList = []
    for (let i = 0; i < wineVersions.length; i++) {
        for (let j = 0; j < wineVersions[i].packages.length; j++) {
            var winePackage = wineVersions[i].packages[j]
            if(wineVersions[i].name.includes('staging')) winePackage.version += `-staging`
            winePackage.version += `-${wineVersions[i].name.split('-').pop()}` //add arch to end of wine version name
            wineList.push(winePackage)
        }
    }

    console.log('writing to cache...')
    fs.writeFileSync(`${tempDirPath}/versions.json`, JSON.stringify(wineList))
    console.log('done fetching!')

    return wineList;
}

async function searchWineVersions(query) {
    var results = []
    for (let i = 0; i < wineVersions.length; i++) {
        if(wineVersions[i].version.toLowerCase().includes(query.toLowerCase())) results.push(wineVersions[i].version)
    }

    results.sort()

    var resultsString = results.join('\n')

    return console.log(resultsString);
}

async function downloadWine(version) {
    var versionObject;
    for (let i = 0; i < wineVersions.length; i++) {
        if(wineVersions[i].version === version || wineVersions[i].version.replace(`-${arch}`, '') === version) { //assumes based off your computer's arch if you dont specify
            if(wineVersions[i].version !== version && wineVersions[i].version.replace(`-${arch}`, '') === version) console.log(`you didnt specify an architecture, so assuming ${arch} based on your computer`)
            versionObject = wineVersions[i]
            break;
        } else if(i == wineVersions.length - 1) {
            console.log('wine version not found, exiting')
            return;
        }
    }

    var wineInstallDir = `${__dirname}/downloads/wine-${versionObject.version}`

    if(fs.existsSync(wineInstallDir)) return console.log(`this version is already installed at ${wineInstallDir}`)

    console.log(`downloading wine version ${versionObject.version}`)

    var buffer = Buffer.from(await (await fetch(versionObject.url)).arrayBuffer())

    console.log('verifying...')
    var hashSum = crypto.createHash('sha1')
    hashSum.update(buffer)
    var hash = hashSum.digest('hex')
    if(hash != versionObject.sha1sum) {
        console.log('sha1 sum mismatch (try again maybe?)')
        fs.rmSync(`${tempDirPath}/${fileName}`)
        return console.log('exiting')
    }

    var fileName = versionObject.url.split('/').pop()
    fs.writeFileSync(`${tempDirPath}/${fileName}`, buffer)
    

    console.log('extracting wine...')
    fs.mkdirSync(wineInstallDir)
    cp.execSync(`tar -xvf ${tempDirPath}/${fileName} -C ${wineInstallDir}`)
    fs.rmSync(`${tempDirPath}/${fileName}`)

    console.log(`done! downloaded to: ${wineInstallDir}`)
}

load()