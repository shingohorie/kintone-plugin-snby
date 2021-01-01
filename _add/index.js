const csv = require('csv-parser');
const fs = require('fs-extra');
const iconv = require('iconv-lite');
const fetch = require('node-fetch');
const moment = require('moment');

const POST_LIMIT = 99;
const APP_ID = 'your-app-id'; 
const APP_DOMAIN = 'your-domain';
const API_URL = `https://${APP_DOMAIN}.cybozu.com/k/v1/records.json?app=${APP_ID}&id=1`;
const API_TOKEN = 'your-token';
const DATA = 'path/to/csv';

let records = [];

// debug
const __debug = function(errors){
	Object.keys(errors).forEach(function(key) {
		let messages = errors[key].messages;
		messages.forEach(function(msg){
			console.log(key + ' : ' + msg)
		});
	});
}

// post records recursive
const __post = (url) => {
	let _records = records.slice(0, POST_LIMIT);
	records = records.slice(POST_LIMIT);

	let opt = {
		method: 'POST',
		headers: {
			'X-Cybozu-API-Token': API_TOKEN,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			"app": APP_ID,
			"records": _records
		})
	}
	
	fetch(url, opt)
		.then((res) => res.json())
		.then((json) => {
			if (!records.length === 0) {
				console.log('completed');
				return;
			}

			if (json.errors) {
				__debug(json.errors);
				return;
			}

			if (json.message) {
				console.log(json.message)
			} else {
				__post(url);
			}
		})
		.catch((err)=>{
			console.error(err);
		});
}

// main
const main = () => {
	fs.createReadStream(DATA).pipe(iconv.decodeStream("Shift_JIS"))
		.pipe(csv({
			separator: ","
		}))
		.on('data', (data) => {
			records.push(data)；
		})
		.on('end', (data) => {
			records = records.map(function(record){
				let obj = {};
				Object.keys(record).forEach(function(key){
					let value = record[key];
					let _key;
					if (key === '作成日時') {
						let created_at = new Date(value);
						created_at = moment(created_at).format('YYYY-MM-DDTHH:mm:ssZ');
						obj['作成日時'] = { 'value': created_at };
						obj['更新日時'] = { 'value': created_at };
					}
					obj[_key] = { 'value': value };
				});
				return obj;
			});
			__post(API_URL);
		});
}

main();