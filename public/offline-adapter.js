/*global jQuery, MM, _, observable*/
MM.OfflineAdapter = function (storage) {
	'use strict';
	this.description = 'OFFLINE';
	this.notSharable = true;
	this.recognises = function (mapId) {
		return mapId && mapId[0] === 'o';
	};
	this.loadMap = function (mapId) {
		var result = jQuery.Deferred();
		storage.load(mapId).then(function (map) {
			if (map) {
				result.resolve(map, mapId, 'application/json', true);
			} else {
				result.reject('not-found');
			}
		});
		return result.promise();
	};
	this.saveMap = function (mapInfo) {
		var result = jQuery.Deferred(),
			resultMapInfo = _.clone(mapInfo);
		try {
			if (!this.recognises(mapInfo.mapId)) {
				storage.saveNew(resultMapInfo.idea).then(function (mapId) {
					resultMapInfo.mapId = mapId;
					result.resolve(resultMapInfo);
				});
			} else {
				storage.save(resultMapInfo.mapId, resultMapInfo.idea);
				result.resolve(resultMapInfo);
			}
		} catch (e) {
			console.log('e', e);
			return result.reject('local-storage-failed', e.toString()).promise();
		}
		return result.promise();
	};
};
MM.OfflineFallback = function (storage) {
	'use strict';
	var localStoragePrefix = 'fallback-';
	this.saveMap = function (mapId, map) {
		storage.setItem(localStoragePrefix + mapId, { map: map });
	};
	this.loadMap = function (mapId) {
		var deferred = jQuery.Deferred();
		storage.getItem(localStoragePrefix + mapId).then(
			function (entry) {
				deferred.resolve((entry && entry.map) || null);
			});
		return deferred.promise();
	};
	this.remove = function (mapId) {
		storage.remove(localStoragePrefix + mapId);
	};
};
MM.OfflineMapStorage = function (storage, keyPrefix) {
	'use strict';
	observable(this);
	keyPrefix = keyPrefix || 'offline';
	var dispatchEvent = this.dispatchEvent,
		keyName = keyPrefix + '-maps';
	var newFileInformation = function (fileDescription) {
			return {d: fileDescription, t: Math.round(+new Date() / 1000)};
		},
		newFileId = function (nextFileNumber) {
			return keyPrefix + '-map-' + nextFileNumber;
		},
		storedFileInformation = function () {
			var deferred = jQuery.Deferred();
			storage.getItem(keyName).then(
				function (files) {
					files = files || { nextMapId: 1, maps: {}};
					files.maps = files.maps || {};
					deferred.resolve(files);
				});
			return deferred.promise();
		},
		store = function (fileId, fileContent, files) {
			files.maps[fileId] = newFileInformation(fileContent.title);
			storage.setItem(fileId, {map: fileContent});
			storage.setItem(keyName, files);
		};
	this.save = function (fileId, fileContent) {
		storedFileInformation().then(
			function (files) {
				store(fileId, fileContent, files);
			}
		);
	};
	this.saveNew = function (fileContent) {
		var deferred = jQuery.Deferred();
		storedFileInformation().then(
			function (files) {
				var fileId = newFileId(files.nextMapId);
				files.nextMapId++;
				store(fileId, fileContent, files);
				deferred.resolve(fileId);
			});
		return deferred.promise();
	};
	this.remove = function (fileId) {
		storedFileInformation().then(
			function (files) {
				storage.remove(fileId);
				delete files.maps[fileId];
				storage.setItem(keyName, files);
				dispatchEvent('mapDeleted', fileId);
			});
	};
	this.restore = function (fileId, fileContent, fileInfo) {
		storedFileInformation().then(
			function (files) {
				files.maps[fileId] = fileInfo;
				storage.setItem(fileId, {map: fileContent});
				storage.setItem(keyName, files);
				dispatchEvent('mapRestored', fileId, fileContent, fileInfo);
			});
	};
	this.list = function () {
		var deferred = jQuery.Deferred();
		storedFileInformation().then(function (files) {
			deferred.resolve(files.maps);
		});
		return deferred.promise();
	};
	this.load = function (fileId) {
		var deferred = jQuery.Deferred();
		storage.getItem(fileId).then(
			function (item) {
				deferred.resolve(item && item.map);
			});
		return deferred.promise();
	};
	return this;
};

MM.OfflineMapStorageBookmarks = function (offlineMapStorage, bookmarks) {
	'use strict';
	offlineMapStorage.addEventListener('mapRestored', function (mapId, map, mapInfo) {
		bookmarks.store({
			mapId: mapId,
			title: mapInfo.d
		});
	});

	offlineMapStorage.addEventListener('mapDeleted', function (mapId) {
		bookmarks.remove(mapId, true);
	});
};