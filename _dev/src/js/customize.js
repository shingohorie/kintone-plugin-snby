; (function (PLUGIN_ID, $) {
	'use strict';

	const GET_LIMIT = 500;
	const PUT_LIMIT = 99;
	let $dupButton, $deteleButton, $birthButton, $overlay;
	let appId;
	let total;

	/*--------------------------------------------------------------------------------
		重複チェック
	--------------------------------------------------------------------------------*/
	const checkDuplicate = function () {

		if (!confirm("重複チェックを行いますか？この操作はもとには戻せません")) return;

		__generateOverlay();

		let body = {
			'app': appId,
			'size': GET_LIMIT,
			"query": "is_invalid != 1 and is_invalid_birth != 1 order by 作成日時",
			"fields": ["$id", "作成日時",
				"post_text", "pref_select", "address_text", "namekana_text", "tel_text", "email_text", "product_radio",
				"is_duplicated", "is_duplicated_tel", "is_duplicated_zip_name", "is_duplicated_mail", "is_checked"]
		};

		return kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', body).then(function (resp) {
			let id = resp.id;
			total = resp.totalCount;
			return id;

		}).then(function (id) {
			return __fetchAllRecords(id);

		}).then(function (records) {

			let invalidRecords = [];
			let duplicatedRecords_1 = [];
			let duplicatedRecords_2 = [];
			let duplicatedRecords_3 = [];
			let duplicatedRecords_4 = [];
			let pristineRecords = [];

			records.forEach(function (ele, i, self) {
				let post = ele.post_text.value;
				let pref = ele.pref_select.value;
				let address = ele.address_text.value;
				let name = __normalizeName(ele.namekana_text.value);
				let tel = ele.tel_text.value;
				let email = ele.email_text.value;
				let product = ele.product_radio.value;
				let isChecked = ele.is_checked.value;

				console.log(i);

				// 重複パターン1
				// 「住所 都道府県」「住所」と「電話番号」と「名前ふりがな」「ご希望商品」がAND条件で同じであれば、重複フラグを立てる
				let lastIndex = _.findLastIndex(self, function (ele2) {
					let _pref = ele2.pref_select.value;
					let _address = ele2.address_text.value;
					let _tel = ele2.tel_text.value;
					let _name =  __normalizeName(ele2.namekana_text.value);
					let _product = ele2.product_radio.value;
					return (pref === _pref) && (address === _address) && (tel === _tel) && (name === _name) && (product === _product);
				});

				let firstIndex = _.findIndex(self, function (ele2) {
					let _pref = ele2.pref_select.value;
					let _address = ele2.address_text.value;
					let _tel = ele2.tel_text.value;
					let _name =  __normalizeName(ele2.namekana_text.value);
					let _product = ele2.product_radio.value;
					return (pref === _pref) && (address === _address) && (tel === _tel) && (name === _name) && (product === _product) ;
				});

				// 重複パターン2
				// 「電話番号」と「ご希望商品」がAND条件で同じであれば、電話番号重複フラグを立てる
				let lastIndex_2 = _.findLastIndex(self, function (ele2) {
					let _tel = ele2.tel_text.value;
					let _product = ele2.product_radio.value;
					return (tel === _tel) && (product === _product);
				});

				let firstIndex_2 = _.findIndex(self, function (ele2) {
					let _tel = ele2.tel_text.value;
					let _product = ele2.product_radio.value;
					return (tel === _tel) && (product === _product);
				});

				// 重複パターン3
				// 「郵便番号」「名前ふりがな」「ご希望商品」がAND条件で同じであれば、郵便番号・名前重複フラグを立てる
				let lastIndex_3 = _.findLastIndex(self, function (ele2) {
					let _post = ele2.post_text.value;
					let _name =  __normalizeName(ele2.namekana_text.value);
					let _product = ele2.product_radio.value;
					return (post === _post) && (name === _name) && (product === _product);
				});

				let firstIndex_3 = _.findIndex(self, function (ele2) {
					let _post = ele2.post_text.value;
					let _name =  __normalizeName(ele2.namekana_text.value);
					let _product = ele2.product_radio.value;
					return (post === _post) && (name === _name) && (product === _product);
				});

				// 重複パターン4
				// 「メールアドレス」「ご希望商品」がAND条件で同じであれば、メールアドレス重複フラグを立てる
				let lastIndex_4 = _.findLastIndex(self, function (ele2) {
					let _email = ele2.email_text.value;
					let _product = ele2.product_radio.value;
					return (email === _email) && (product === _product);
				});

				let firstIndex_4 = _.findIndex(self, function (ele2) {
					let _email = ele2.email_text.value;
					let _product = ele2.product_radio.value;
					return (email === _email) && (product === _product);
				});

				if (i % 100 === 0) $overlay.text(total + '件中 ' + i +'件目のレコードの重複を調査');

				// 重複チェック済みのものにフラグを立てる
				if (!isChecked || isChecked === void 0 || parseFloat(isChecked) === 0 ) pristineRecords.push(ele);

				if (self[lastIndex].is_duplicated.value == 1) {
					// 最も古い重複レコードが1の時は、10ヶ月経過後に削除されている
					// 最新の重複レコード以外は論理削除フラグを立てる
					if (i !== firstIndex) invalidRecords.push(ele);
				} else {
					if (i !== lastIndex) duplicatedRecords_1.push(ele);
				}

				if (lastIndex_2 != firstIndex_2) duplicatedRecords_2.push(ele);
				if (lastIndex_3 != firstIndex_3) duplicatedRecords_3.push(ele);
				if (lastIndex_4 != firstIndex_4) duplicatedRecords_4.push(ele);

			});

			records = [];

			invalidRecords = invalidRecords.map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_duplicated: { value: 1 },
						is_invalid: { value: 1 }
					}
				}
			});

			duplicatedRecords_1 = duplicatedRecords_1.filter(function (ele, i, self) {
				let isDirty = parseFloat(ele.is_duplicated.value);
				return !isDirty;
			}).map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_duplicated: { value: 1 }
					}
				}
			});

			duplicatedRecords_2 = duplicatedRecords_2.filter(function (ele, i, self) {
				let isDirty = parseFloat(ele.is_duplicated_tel.value) === 1;
				return !isDirty;
			}).map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_duplicated_tel: { value: 1 }
					}
				}
			});

			duplicatedRecords_3 = duplicatedRecords_3.filter(function (ele, i, self) {
				let isDirty = parseFloat(ele.is_duplicated_zip_name.value) === 1;
				return !isDirty;
			}).map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_duplicated_zip_name: { value: 1 }
					}
				}
			});

			duplicatedRecords_4 = duplicatedRecords_4.filter(function (ele, i, self) {
				let isDirty = parseFloat(ele.is_duplicated_mail.value) === 1;
				return !isDirty;
			}).map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_duplicated_mail: { value: 1 }
					}
				}
			});

			pristineRecords = pristineRecords.map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_checked: { value: 1 }
					}
				}
			});

			$overlay.text('重複フラグをマークしています');

			return Promise.all([
				__updateRecords(pristineRecords),
				__updateRecords(duplicatedRecords_1),
				__updateRecords(invalidRecords),
				__updateRecords(duplicatedRecords_2),
				__updateRecords(duplicatedRecords_3),
				__updateRecords(duplicatedRecords_4)
			]);

		}).then(function (results) {

			let isFail = results.filter(function (ele) {
				return ele.state === 'fail';
			}).length > 0;

			if (results[0].state === 'success') {
				$overlay.text('');
				alert('更新が完了しました');
				location.reload();
			} else if (results[0].state === 'zero result') {
				$overlay.text('');
				alert('重複するレコードはありませんでした');
				location.reload();
			} else if (isFail) {
				$overlay.text('');
				alert('更新に失敗したか、権限がありません');
				$overlay.fadeOut(function () { $overlay.remove(); });
			}
		}).catch(function (e) {
			$overlay.text('');
			alert(e.message);
			$overlay.fadeOut(function () { $overlay.remove(); });
			return;
		});
	}

	/*--------------------------------------------------------------------------------
		誕生日チェック
	--------------------------------------------------------------------------------*/
	const checkBirthday = function () {

		if (!confirm("誕生日チェックを行いますか？この操作はもとには戻せません")) return;
		__generateOverlay();

		let body = {
			'app': appId,
			'size': GET_LIMIT,
			"query": "is_invalid_birth != 1 order by 作成日時",
			"fields": ["$id", "作成日時", "kidsbirthyear_select", "kidsbirthmonth_select", "kidsbirthday_select", "is_invalid_brth"]
		};

		return kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', body).then(function (resp) {
			let id = resp.id;
			total = resp.totalCount;
			return id;

		}).then(function (id) {
			return __fetchAllRecords(id);

		}).then(function (records) {
			let invalidRecords = records.filter(function (ele, i, self) {
				let year = ele.kidsbirthyear_select.value.replace(/(\d{4})(.*)/, '$1');
				let month = ('00' + ele.kidsbirthmonth_select.value).slice(-2);
				let day = ('00' + ele.kidsbirthday_select.value).slice(-2);
				let created_at = moment(ele["作成日時"].value);
				let birthday = moment(year + '-' + month + '-' + day);
				return birthday.isAfter(created_at);
			}).map(function (ele) {
				return {
					id: ele.$id.value,
					record: {
						is_invalid_birth: { value: 1 }
					}
				}
			});

			return Promise.all([
				__updateRecords(invalidRecords)
			]);

		}).then(function (results) {
			if (results[0].state === 'success') {
				$overlay.text('');
				alert('更新が完了しました');
				location.reload();
			} else if (results[0].state === 'zero result') {
				$overlay.text('');
				alert('誕生日が無効なレコードはありませんでした');
				$overlay.fadeOut(function () { $overlay.remove(); });
			} else if (payload[0].state === 'fail') {
				$overlay.text('');
				alert(payload[0].e.message);
				$overlay.fadeOut(function () { $overlay.remove(); });
			}
		}).catch(function (e) {
			$overlay.text('');
			alert(e.message);
			$overlay.fadeOut(function () { $overlay.remove(); });
			return;
		});
	}

	/*--------------------------------------------------------------------------------
		過去のレコードを削除
	--------------------------------------------------------------------------------*/
	const deleteOutdated = function () {

		let str = prompt("10ヶ月前のレコードを削除しますか？この操作はもとに戻せません。よろしければ「削除」と入力してください");

		if (str !== '削除') {
			alert('削除はキャンセルされました')
			return;
		}

		__generateOverlay();

		let body = {
			'app': appId,
			'size': GET_LIMIT,
			"query": "作成日時 < FROM_TODAY(-10, MONTHS)",
			"fields": ["$id", "作成日時"]
		};

		return kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', body).then(function (resp) {
			let id = resp.id;
			total = resp.totalCount;
			return id;
		}).then(function (id) {
			return __fetchAllRecords(id);
		}).then(function (records) {

			let ids = records.map(function (record, i) {
				return record.$id.value;
			});

			return Promise.all([
				__deleteRecords(ids)
			]);

		}).then(function (payload) {
			if (payload[0].state === 'success') {
				$overlay.text('');
				alert('削除が完了しました');
				location.reload();
			} else if (payload[0].state === 'zero result') {
				$overlay.text('');
				alert('削除対象となるレコードはありませんでした');
				$overlay.fadeOut(function () { $overlay.remove(); });
			} else if (payload[0].state === 'fail') {
				$overlay.text('');
				alert(payload[0].e.message);
				$overlay.fadeOut(function () { $overlay.remove(); });
			}
		}).catch(function (e) {
			$overlay.text('');
			alert(e.message);
			$overlay.fadeOut(function () { $overlay.remove(); });
			return;
		});
	}

	/*--------------------------------------------------------------------------------
		カーソルから全てのレコードを取得
	--------------------------------------------------------------------------------*/
	const __fetchAllRecords = function (id, arr) {

		if (typeof arr === 'undefined') arr = [];

		return kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'GET', { 'id': id }).then(function (resp) {
			if (resp.next) {
				arr = arr.concat(resp.records);
				$overlay.text(total + '件中 '+arr.length + '件を取得');
				return __fetchAllRecords(id, arr);
			} else {
				arr = arr.concat(resp.records);
				return arr
			}
		});
	}

	/*--------------------------------------------------------------------------------
		レコードを更新
	--------------------------------------------------------------------------------*/
	const __updateRecords = function (records, progress) {

		if (typeof progress === 'undefined') progress = 0;

		if (!records.length) return { state: 'zero result' };

		let _records = records.slice(0, PUT_LIMIT);
		records = records.slice(PUT_LIMIT);
		progress += _records.length;

		let param = {
			'app': appId,
			'records': _records
		};

		return kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', param).then(function () {
			if (records.length > 0) {
				$overlay.text((progress + records.length) + '件中 ' + progress + '件を処理');
				return __updateRecords(records, progress);
			} else {
				$overlay.text((progress + records.length) + '件中 ' + progress + '件を処理');
				return { state: 'success' };
			}
		}).catch(function (e) {
			return { state: 'fail', err: e };
		})
	}

	/*--------------------------------------------------------------------------------
		レコードを削除
	--------------------------------------------------------------------------------*/
	const __deleteRecords = function (ids, progress) {

		if (typeof progress === 'undefined') progress = 0;

		if (!ids.length) return { state: 'zero result' };

		let _ids = ids.slice(0, PUT_LIMIT);
		ids = ids.slice(PUT_LIMIT);
		progress += _ids.length;

		let param = {
			'app': appId,
			'ids': _ids
		};

		return kintone.api(kintone.api.url('/k/v1/records', true), 'DELETE', param).then(function () {
			if (ids.length > 0) {
				$overlay.text((progress + ids.length) + '件中 ' + progress + '件を処理');
				return __deleteRecords(ids, idx);
			} else {
				$overlay.text((progress + ids.length) + '件中 ' + progress + '件を処理');
				return { state: 'success' };
			}
		}).catch(function (e) {
			return { state: 'fail', err: e };
		})
	}

	/*--------------------------------------------------------------------------------
		オーバーレイを表示
	--------------------------------------------------------------------------------*/
	const __generateOverlay = function () {
		$overlay = $('<div id="overlay"></div>')
		kintone.app.getHeaderMenuSpaceElement().appendChild($overlay.get(0));
	}

	/*--------------------------------------------------------------------------------
		名前（カナ）を正規化
	--------------------------------------------------------------------------------*/
	const __normalizeName = function(str) {
		return str.replace(/　/g,' ').replace(/\s+/g, '').replace(/[ぁ-ん]/g, function(s) {
			return String.fromCharCode(s.charCodeAt(0) + 0x60);
		});
	}

	/*--------------------------------------------------------------------------------
		main
	--------------------------------------------------------------------------------*/
	kintone.events.on('app.record.index.show', function (event) {
		appId = event.appId;

		if (!$birthButton) {
			$birthButton = $('<button id="birthButton" class="kintoneplugin-button-normal">誕生日をチェック</button>');
			kintone.app.getHeaderMenuSpaceElement().appendChild($birthButton.get(0));
			$birthButton.on('click', checkBirthday);
		}

		if (!$dupButton) {
			$dupButton = $('<button id="dupButton" class="kintoneplugin-button-normal">重複をチェック</button>');
			kintone.app.getHeaderMenuSpaceElement().appendChild($dupButton.get(0));
			$dupButton.on('click', checkDuplicate);
		}

		if (!$deteleButton) {
			$deteleButton = $('<button id="deteleButton" class="kintoneplugin-button-normal">過去のレコードを削除</button>');
			kintone.app.getHeaderMenuSpaceElement().appendChild($deteleButton.get(0));
			$deteleButton.on('click', deleteOutdated);
		}
	});

})(kintone.$PLUGIN_ID, jQuery.noConflict(true));
