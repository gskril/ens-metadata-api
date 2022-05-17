require('dotenv').config()
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

const ethers = require('ethers')

const provider = new ethers.providers.InfuraProvider('homestead', {
	projectId: process.env.INFURA_PROJECT_ID,
	projectSecret: process.env.INFURA_PROJECT_SECRET,
})

app.listen(port, () => {
	console.log(`Your application is running on port ${port}`)
})

// Avoid Express always trying to request the favicon
app.get('/favicon.ico', (req, res) => res.status(204).end())

app.get('/', (req, res) => {
	res.send(`
		<p>Request ENS records for a name like <a href="/nick.eth">nick.eth</a></p>
		<p>Optionally append <a href="/nick.eth?avatar">'?avatar'</a> 
		to include the ENS avatar, but it will take a bit longer</p>`)
})

// Set CORS policy to allow all origins
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*')
	res.header(
		'Access-Control-Allow-Headers',
		'Origin, X-Requested-With, Content-Type, Accept'
	)
	next()
})

app.get('/:address', async (req, res) => {
	const startTime = Date.now()
	const input = req.params.address.toLowerCase()

	let name, address

	if (input.length === 42 && input.startsWith('0x')) {
		// If the input is likely to be an ETH address,
		// normalize character cases using getIcapAddress
		try {
			address = ethers.utils.getAddress(
				ethers.utils.getIcapAddress(input)
			)
			name = await provider.lookupAddress(address) // null if the address doesn't have a primary ENS name
		} catch (err) {
			name = input
			address = null
		}
	} else {
		name = input
		address = null
	}

	if (name === null) {
		return res.status(404).send({ error: 'Address not found' })
	}

	const resolver = await provider.getResolver(name)

	if (resolver === null) {
		return res.status(404).send({ error: 'Address not found' })
	}

	const requestingAvatar = req.query.avatar !== undefined ? true : false
	const avatar = requestingAvatar ? await resolver.getAvatar() : null

	const records = {
		name: name,
		address: address ? address : await provider.resolveName(name),
		description: await resolver.getText('description'),
		avatar: requestingAvatar ? avatar.url : null,
		url: await resolver.getText('url'),
		telegram: await resolver.getText('org.telegram'),
		twitter: await resolver.getText('com.twitter'),
		github: await resolver.getText('com.github'),
		email: await resolver.getText('email'),
	}

	const endTime = Date.now()
	const requestTime = endTime - startTime

	res.status(200).json(records)
})
