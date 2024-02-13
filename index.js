//this is old-ish code, no judge plz

const fs = require('fs')
const crypto = require('crypto')
const cp = require('child_process')
const os = require('os')

let arch = os.arch().replace('x64', 'amd64')
if (arch !== 'x86' && arch !== 'amd64') return console.log(`your computer's architecture (${arch}) is not supported by wvd`);

let commands = {
    '--fetch': fetchWineVersions,
    '--download': downloadWine,
    '--search': searchWineVersions,
    '--help': helpCommand
}

let command;
let commandArg;

for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i].startsWith('--')) {
        command = process.argv[i]
        commandArg = process.argv.slice(i + 1).join(' ')
        break;
    }
}

let wineVersions;
let tempDirPath;

async function load() {
    if (!fs.existsSync(`${__dirname}/downloads`)) fs.mkdirSync(`${__dirname}/downloads`)
    tempDirPath = '/tmp/wvd'
    if (!fs.existsSync(tempDirPath)) fs.mkdirSync(tempDirPath) //tmp dir for downloaded tars
    wineVersions = fs.existsSync(`${tempDirPath}/versions.json`) ? JSON.parse(fs.readFileSync(`${tempDirPath}/versions.json`).toString()) : await fetchWineVersions()

    if (commands[command]) {
        commands[command](commandArg) //readable code :)
    } else {
        helpCommand()
    }
}


function helpCommand() {
    let helpString = 'usage:\n\n' +
    'wvd --fetch: re-fetches wine version list cache (which is cleared at every startup anyways)\n' +
    'wvd --search (args): lets you search for wine versions\n' +
    'wvd --download (args): lets you download any of the versions in the list\n' +
    'wvd --help: displays this help message'

    console.log(helpString)
}

async function fetchWineVersions(force) { //force does the exact opposite of what youd expect
    if (fs.existsSync(`${tempDirPath}/versions.json`) && force) return wineVersions;

    console.log(`fetching wine version list... ${force ? '(this only happens every restart)' : ''}`)
    let wineVersions = await (await fetch('https://phoenicis.playonlinux.com/index.php/wine?os=linux')).json()

    let wineList = []
    for (let i = 0; i < wineVersions.length; i++) {
        for (let j = 0; j < wineVersions[i].packages.length; j++) {
            let winePackage = wineVersions[i].packages[j]
            if (wineVersions[i].name.includes('staging')) winePackage.version += `-staging`
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
    let results = []
    for (let i = 0; i < wineVersions.length; i++) {
        if (wineVersions[i].version.toLowerCase().includes(query.toLowerCase())) {
            results.push(wineVersions[i].version)
        }
    }

    results.sort()

    let resultsString = results.join('\n')
    console.log(resultsString)
}

async function downloadWine(version) {
    let versionObject;
    for (let i = 0; i < wineVersions.length; i++) {
        if (wineVersions[i].version == version || wineVersions[i].version.replace(`-${arch}`, '') == version) { //assumes based off your computer's arch if you dont specify
            if (wineVersions[i].version != version && wineVersions[i].version.replace(`-${arch}`, '') == version) console.log(`you didnt specify an architecture, so assuming ${arch} based on your computer`)
            versionObject = wineVersions[i]
            break;
        } else if (i == wineVersions.length - 1) {
            console.log('wine version not found, exiting with code 1')
            return process.exit(1);
        }
    }

    let wineInstallDir = `${__dirname}/downloads/wine-${versionObject.version}`

    if (fs.existsSync(wineInstallDir)) return console.log(`this version is already installed at ${wineInstallDir}`);

    console.log(`downloading wine version ${versionObject.version}`)

    let buffer = Buffer.from(await (await fetch(versionObject.url)).arrayBuffer())

    console.log('verifying...')
    let hashSum = crypto.createHash('sha1')
    hashSum.update(buffer)
    let hash = hashSum.digest('hex')
    if (hash != versionObject.sha1sum) {
        console.log('sha1 sum mismatch (try again maybe?)')
        fs.rmSync(`${tempDirPath}/${fileName}`)
        console.log('exiting with code 1')
        return process.exit(1);
    }

    let fileName = versionObject.url.split('/').pop()
    fs.writeFileSync(`${tempDirPath}/${fileName}`, buffer)

    console.log('extracting wine...')
    fs.mkdirSync(wineInstallDir)
    cp.execSync(`tar -xvf ${tempDirPath}/${fileName} -C ${wineInstallDir}`)
    fs.rmSync(`${tempDirPath}/${fileName}`)

    console.log(`done! downloaded to: ${wineInstallDir}`)
}

load()