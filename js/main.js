/* FlashAir Fancy Web Interface by Dr. Lex
 * Based on FlashAir tutorial code.
 * Released under BSD 2-Clause License.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
 * FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 * CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY
 * WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/************************** Configurable bits **************************/

// If this value is non-zero, a confirmation dialog will be shown when trying to upload files with
// a name longer than this number of characters.
var maxNameLength = 31;  // Sailfish seems to skip anything with more than 31 characters

// If a file has one of these extensions (must be listed in lowercase), show a confirmation
// dialog when uploading. I really need this because I keep on uploading .gcode files instead
// of their .x3g conversions.
var warnExtensions = ["gcode"];

/************************** No user serviceable parts below **************************/

var version = "1.4";

var fileList = [];
var moveSelections = {}; // Key = path, value = see fileTypes
var uploadQueue = [];
var fileIndices = {};  // Key = name, value = file index in list
var fileTypes = {};  // Key = name, value = 'f' for file or 'd' for dir
var lastCheckedIndex = null;
var sortMode = 'da';

// Important: any operation that changes the filesystem, must include a WRITEPROTECT call
// to upload.cgi, to avoid inconsistencies or corruption if something else would try to
// write to the card afterwards using stale filesystem information.

// Judge the card is V1 or V2.
function isV1(wlansd) {
	if( wlansd.length == undefined || wlansd.length == 0 ) {
		// List is empty so the card version is not detectable. Assumes as V2.
		return false;
	} else if( wlansd[0].length != undefined ) {
		// Each row in the list is array. V1.
		return true;
	} else {
		// Otherwise V2.
		return false;
	}
}
// Convert data format from V1 to V2.
function convertFileList() {
	for(var i = 0; i < wlansd.length; i++) {
		var elements = wlansd[i].split(",");
		wlansd[i] = new Array();
		wlansd[i]["r_uri"] = elements[0];
		wlansd[i]["fname"] = elements[1];
		wlansd[i]["fsize"] = Number(elements[2]);
		wlansd[i]["attr"]  = Number(elements[3]);
		wlansd[i]["fdate"] = Number(elements[4]);
		wlansd[i]["ftime"] = Number(elements[5]);
	}
}
// Callback Functions for sort() if sortMode = 'd*'
function cmptimeA(a, b) {
	if( a["fdate"] == b["fdate"] ) {
		return a["ftime"] - b["ftime"];
	}else{
		return a["fdate"] - b["fdate"];
	}
}
function cmptimeD(b, a) {
	if( a["fdate"] == b["fdate"] ) {
		return a["ftime"] - b["ftime"];
	}else{
		return a["fdate"] - b["fdate"];
	}
}

// Callback Functions for sort() if sortMode = 's*'
function cmpsizeA(a, b) {
	return a["fsize"] - b["fsize"];
}
function cmpsizeD(b, a) {
	return a["fsize"] - b["fsize"];
}

// Callback Functions for sort() if sortMode = 'f*'
function cmpnameA(a, b) {
	return a["fname"].localeCompare(b["fname"]);
}
function cmpnameD(b, a) {
	return a["fname"].localeCompare(b["fname"]);
}


function escapeString(str) {
	return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

function pad(val, size, pad) {
	pad = (typeof pad !== 'undefined') ? pad : "0";
	var out = val + "";
	while(out.length < size)
		out = pad + out;
	return out
}

function fancyFileSize(bytes) {
	if(bytes < 1e3)
		return bytes + "&nbsp;B";
	if(bytes < 1e6)
		return Math.round(bytes/1e3) + "&nbsp;kB";
	if(bytes < 1e8)
		return Math.round(bytes/1e4)/100 + "&nbsp;MB";
	if(bytes < 1e9)
		return Math.round(bytes/1e6) + "&nbsp;MB";
	if(bytes < 1e11)
		return Math.round(bytes/1e7)/100 + "&nbsp;GB";
	return Math.round(bytes/1e9) + "&nbsp;GB";
}

function makeHexDate()
{
	var dt = new Date();
	var year = (dt.getFullYear() - 1980) << 9;
	var month = (dt.getMonth() + 1) << 5;
	var date = dt.getDate();
	var hours = dt.getHours() << 11;
	var minutes = dt.getMinutes() << 5;
	var seconds = Math.floor(dt.getSeconds() / 2);
	return "0x" + (year + month + date).toString(16) + pad((hours + minutes + seconds).toString(16), 4);
}

function makeDateString(dateNum, timeNum)
{
	if(dateNum == 0 && timeNum == 0)
		return "––––/––/–– ––:––:––";
	var day = dateNum % 32;
	var month = (dateNum >> 5) % 16;
	var year = (dateNum >> 9) + 1980;
	var seconds = (timeNum % 32) * 2;
	var minutes = (timeNum >> 5) % 64;
	var hours = (timeNum >> 11);
	return year + '/' + pad(month, 2) + '/' + pad(day, 2) + ' ' + pad(hours, 2) + ':' + pad(minutes, 2) + ':' + pad(seconds, 2);
}

function showFreeSpace(numItems) {
	var url = "/command.cgi?op=140";
	// Issue CGI command.
	$.get(url, function(data) {
		// Split sizes,sectorSize.
		var items = data.split(/,/g);
		// Ignore the first line (title) and last line (blank).
		var sectorSize = items.pop();
		items = items[0].split(/\//g);
		var freeSpace = items[0] * sectorSize;
		var totalSpace = items[1] * sectorSize;
		$("#footer").html(numItems + " items; " + fancyFileSize(freeSpace) + " free of " + fancyFileSize(totalSpace));
	});
}

function getFWVersion()
{
	var url = "/command.cgi?op=108";
	// Issue CGI command.
	$.get(url, function(data) {
		$("#version").html("FlashAirUI v" + version + "; firmware " + data);
	});
}

function setBusy() {
	// Shows spinner in top left, for operations that should not take long
	$("#header").children("h1").addClass("busy");
}

function clearBusy() {
	$("#header").children("h1").removeClass("busy");
}

function setGlass(title, message) {
	// Blocks the entire page with a glass window, for operations that take long and hog the card's processor
	$("#glassAction").html(title);
	$("#glassMessage").html(message);
	$("#glassPane").css("display", "inline");
}

function setGlassStatus(message) {
	$("#glassMessage").html(message);
}

function clearGlass() {
	$("#glassPane").css("display", "none");
}

function setSort(mode) {
	sortMode = mode;
	getFileList(".");
}

function makeSortBtn(mode) {
	if(mode != sortMode) {
		return "<span onclick='setSort(\"" + mode + "\")'>" + (mode[1] == 'a' ? '▲' : '▼') + "</span>";
	}
	return "<span onclick='setSort(\"" + mode + "\")'>" + (mode[1] == 'a' ? '△' : '▽') + "</span>";
}

// Show file list
function showFileList(path) {
	// Clear box.
	$("#list").html('');
	fileList = [];
	fileIndices = {};
	fileTypes = {};
	lastCheckedIndex = null;

	// Construct clickable path in header
	var pathItems = path.split(/\//g);
	if(path == "/")
		pathItems.pop();
	var linkPath = '';
	var header = $('<span></span>'); //$('<h1></h1>');
	$.each(pathItems, function() {
		var dirName = this;
		var prefix = "/";
		if(this != "")
			linkPath += "/" + this;
		else {
			prefix = "";
			dirName = "📂 ";
		}
		header.append(prefix + '<a href="javascript:getFileList(\'' + escapeString(linkPath) + '\')">' + dirName + '</a>');
	});
	if(path == "/")
		header.append("/");
	$("#header").html(header);

	var table = $('<table></table>').addClass('filelist');
	table.append(
		$("<tr></tr>").append([
			$("<td></td>").addClass("head"),
			$("<td></td>").addClass("head"),
			$("<td></td>").addClass("head"),
			$("<td></td>").addClass("head").append(makeSortBtn("fa") + ' ' + makeSortBtn("fd")),
			$("<td></td>").addClass("head").append(makeSortBtn("sa") + ' ' + makeSortBtn("sd")),
			$("<td></td>").addClass("head").append(makeSortBtn("da") + ' ' + makeSortBtn("dd"))
		])
	);

	// Output a link to the parent directory if it is not the root directory.
	if(path != "/") {
		table.append(
			$("<tr></tr>").append([
				$("<td></td>").addClass("col_check"),
				$("<td></td>").addClass("col_del"),
				$("<td></td>").addClass("col_ren"),
				$("<td></td>").addClass("col_file").append(
					$('<a href="javascript:void(0)" class="dir">..</a>'))
			])
		);
	}
	var isEmpty = true;
	var pathSlashed = path;
	if(! path.endsWith("/"))
		pathSlashed += "/";
	var index = 0;
	$.each(wlansd, function() {
		var file = this;
		isEmpty = false;
		// Skip hidden file.
		if(file["attr"] & 0x02) {
			return;
		}
		// Make a link to directories and files.
		var fileLink = $('<a href="javascript:void(0)"></a>');
		var delLink = $('<a></a>');
		var renLink = $('<a></a>');
		var caption = file["fname"];
		var filesize = '';
		if(file["attr"] & 0x10) {
			fileLink.addClass("dir");
			fileTypes[caption] = "d";
		} else {
			fileLink.addClass("file").attr('href', file["r_uri"] + '/' + file["fname"]).attr("target","_blank");
			delLink.addClass("del").attr('href', 'javascript:doDelete("' + escapeString(file["fname"]) + '")');
			delLink.append('⨂');
			filesize = fancyFileSize(file["fsize"]);
			fileTypes[caption] = "f";
		}
		fileDate = makeDateString(file["fdate"], file["ftime"]);
		renLink.attr('href', 'javascript:doRename("' + escapeString(file["fname"]) + '")');
		renLink.append('✎');
		// Append a file entry or directory to the end of the list.
		var row = $("<tr></tr>");
		var checkbox = $('<input type="checkbox">').addClass("selectMove");
		if(moveSelections[pathSlashed + file["fname"]])
			checkbox.prop('checked', true);
		row.append($("<td></td>").addClass("col_check").append(checkbox));
		row.append($("<td></td>").addClass("col_del").append(delLink));
		row.append($("<td></td>").addClass("col_ren").append(renLink));
		row.append($("<td></td>").addClass("col_file").append(fileLink.append(caption)));
		row.append($("<td></td>").addClass("col_size").append(filesize));
		row.append($("<td></td>").addClass("col_date").append(fileDate));
		table.append(row);

		fileList.push(caption);
		fileIndices[caption] = index;
		index++;
	});
	$("#list").append(table);
	if(isEmpty)
		$('#cmdDelDir').removeAttr('disabled');
	else {
		$('#cmdDelDir').attr('disabled', 'disabled');
	}
	checkMoveAllowed(path);
	checkMultiDelAllowed(path);
	clearBusy();
}

// Making Path
function makePath(dir) {
	if(dir == "")
		return "/";
	if(dir.substr(0, 1) == "/")
		return dir;
	var arrPath = currentPath.split('/');
	if( currentPath == "/" ) {
		arrPath.pop();
	}
	if( dir == ".." ) {
		// Go to parent directory. Remove last fragment.
		arrPath.pop();
	} else if( dir != "" && dir != "." ) {
		// Go to child directory. Append dir to the current path.
		arrPath.push(dir);
	}
	if( arrPath.length == 1 ) {
		arrPath.push("");
	}
	return arrPath.join("/");
}

// Get file list
function getFileList(dir) {
	setBusy();
	// Make a path to show next.
	var nextPath = makePath(dir);
	// Make URL for CGI. (DIR must not end with '/' except if it is the root.)
	var url = "/command.cgi?op=100&DIR=" + nextPath;
	// Issue CGI command.
	$.get(url, function(data) {
		// Save the current path.
		currentPath = nextPath;
		// Split lines by new line characters.
		wlansd = data.split(/\n/g);
		// Ignore the first line (title) and last line (blank).
		wlansd.shift();
		wlansd.pop();
		// Convert to V2 format.
		convertFileList(wlansd);
		if(sortMode == 'dd')
			wlansd.sort(cmptimeD);
		else if(sortMode == 'da')
			wlansd.sort(cmptimeA);
		else if(sortMode == 'sd')
			wlansd.sort(cmpsizeD);
		else if(sortMode == 'sa')
			wlansd.sort(cmpsizeA);
		else if(sortMode == 'fd')
			wlansd.sort(cmpnameD);
		else { // 'fa'
			wlansd.sort(cmpnameA);
		}
		// Show
		showFileList(currentPath);
		showFreeSpace(wlansd.length);
	});
}

//Update set of files selected for moving
function setMoveSelection(name, checked, shiftKey) {
	var start = fileIndices[name];
	var stop = start;
	if(shiftKey && lastCheckedIndex !== null) {
		stop = lastCheckedIndex;
		if(stop < start) {
			stop = start;
			start = lastCheckedIndex;
		}
	}
	var path = makePath(".");
	if(path != "/")
		path += "/";
	for(var i = start; i <= stop; i++) {
		var fullPath = path + fileList[i];
		if(checked)
			moveSelections[fullPath] = fileTypes[fileList[i]];
		else if(moveSelections[fullPath]) {
			delete moveSelections[fullPath];
		}
	}

	if(shiftKey)
		showFileList(currentPath);  // refresh the whole list to update other checkboxes
	else {
		checkMoveAllowed(path);
		checkMultiDelAllowed(path);
	}
	lastCheckedIndex = fileIndices[name];
}

function checkMoveAllowed(path) {
	// As soon as a folder is selected, it is prohibited to try moving it into a subfolder of itself.
	if(path != "/" && ! path.endsWith("/"))
		path += "/";

	var moveAllowed = true;
	var isEmpty = true;
	for(var selected in moveSelections) {
		isEmpty = false;
		if(path.startsWith((selected + "/"))) {
			moveAllowed = false;
			break;
		}
	}
	if(isEmpty) {
		$('#cmdClearMove').attr('disabled', 'disabled');
		$('#cmdClearMove').html("Clear selections");
	} else {
		$('#cmdClearMove').removeAttr('disabled');
		$('#cmdClearMove').html("Clear selections (" + Object.keys(moveSelections).length + ")");
	}
	if(!isEmpty && moveAllowed) {
		$('#cmdMove').removeAttr('disabled');
	} else {
		$('#cmdMove').attr('disabled', 'disabled');
	}
}

function checkMultiDelAllowed(path) {
	// Multi-delete is only allowed if all selections are files within the current path.
	if(path != "/" && ! path.endsWith("/"))
		path += "/";

	var delAllowed = true;
	var isEmpty = true;
	for(var selected in moveSelections) {
		isEmpty = false;
		if(moveSelections[selected] == 'd') {
			delAllowed = false;
			break;
		}
		var pathItems = selected.split('/');
		var dirName = pathItems.slice(0, pathItems.length - 1).join('/') + '/';
		if(path != pathItems.slice(0, pathItems.length - 1).join('/') + '/') {
			delAllowed = false;
			break;
		}
	}
	if(!isEmpty && delAllowed) {
		$('#cmdMultiDel').removeAttr('disabled');
	} else {
		$('#cmdMultiDel').attr('disabled', 'disabled');
	}
}

//UploadProcess
function doUpload() {
	var alreadyAsked = [];
	$.each($('#file')[0].files, function(index, uploadFile) {
		var fileName = uploadFile.name;
		var abort = false;
		$.each(warnExtensions, function(index, value) {
			if(alreadyAsked.indexOf(value) > -1)
				return true;
			if(fileName.toLowerCase().endsWith("." + value)) {
				if(! confirm("Are you sure you want to upload a ‘." + value + "’ file?"))
					abort = true;
				else {
					alreadyAsked.push(value);
				}
				return false;
			}
		});
		if(abort) {
			uploadQueue = [];
			return false;
		}
		if(maxNameLength && fileName.length > maxNameLength) {
			if(! confirm("The file '" + fileName + "' has a name longer than " + maxNameLength +
				     " characters (" + fileName.length + "), which may cause problems. Proceed?")) {
				uploadQueue = [];
				return false;
			}
		}
		uploadQueue.push(uploadFile);
	});

	processUploads();
}

function processUploads() {
	if(! uploadQueue.length) {
		getFileList(".");
		clearGlass();
		$("#cmdUpload").removeClass("busy");
		$("#cmdUpload").html('Upload');
		// Clear the upload input element. Slightly annoying because with the single-file
		// version, it was possible to keep re-uploading the same file after modifying it.
		// With multi-file upload, certain browsers will refuse to re-upload if any of the
		// files have changed since selecting them. Worse, this cannot be fixed by re-
		// selecting the same file, because browsers are stupid, especially the one from
		// our favourite new quasi-monopolist that once vowed to never become evil. COUGH.
		$("#file").val('');
		return;
	}

	var uploadFile = uploadQueue.shift();
	var fileName = uploadFile.name;
	$("#cmdUpload").prop("disabled", true);
	$("#cmdUpload").html('Uploading…');
	$("#cmdUpload").addClass("busy");
	var left2Do = uploadQueue.length ? "<br>Files remaining: " + uploadQueue.length : "";
	setGlass("Uploading…", "Uploading ‘" + fileName + "’" + left2Do);

	var path = makePath(".");
	var cgi = "/upload.cgi";
	var timestring = makeHexDate();
	$.get(cgi + "?WRITEPROTECT=ON&UPDIR=" + path + "&FTIME=" + timestring, function() {
		var fd = new FormData();
		fd.append("file", uploadFile);
		$.ajax({ url: cgi,
			type: "POST",
			data: fd,
			processData: false,
			contentType: false,
			success: function(html) {
				if(html.indexOf("Success") < 0) {
					alert("Error");
					uploadQueue = [];
				}
			},
			error: function(jqxhr, status) {
				alert(status);
				uploadQueue = [];
			},
			complete: processUploads
		});
	});
}

// Delete a file
function doDelete(fileName) {
	setBusy();
	var path = makePath(fileName);
	var cgi = "/upload.cgi";
	$.get(cgi + "?WRITEPROTECT=ON", function() {
		$.get(cgi + "?DEL=" + encodeURIComponent(path), function(data) {
			if(data.indexOf("SUCCESS") > -1) {
				if(moveSelections[path])
					delete moveSelections[path];
				getFileList(".");
			} else {
				alert("Error: ‘" + data + "’");
				clearBusy();
			}
		});
	});
}

// Start deleting all the selected files
function startMultiDelete() {
	setGlass("Deleting files…", "");
	$.get("/upload.cgi?WRITEPROTECT=ON", function() {
		doMultiDelete();
	});
}

// Continue deleting all the selected files
function doMultiDelete() {
	var left2Del = Object.keys(moveSelections).length;
	if(! left2Del) {
		getFileList(".");
		$('#cmdMultiDel').attr('disabled', 'disabled');
		clearGlass();
		return;
	}
	setGlassStatus("Left to delete: " + left2Del);

	var nextToDelete = Object.keys(moveSelections)[0];
	$.get("/upload.cgi?DEL=" + encodeURIComponent(nextToDelete), function(data) {
		if(data.indexOf("SUCCESS") > -1) {
			if(moveSelections[nextToDelete]) {
				delete moveSelections[nextToDelete];
			}
		} else {
			alert("Error: ‘" + data + "’");
			moveSelections = {};
		}
		doMultiDelete();
	});
}

// Rename a file or folder
function doRename(fileName) {
	var newName = window.prompt("New name:", fileName);
	if(! newName)
		return;
	var regExpInvalidChars = new RegExp(/[\/\\?%:|<>*]+/g);
	var cleanName = newName.replace(regExpInvalidChars, "");
	if(cleanName != newName) {
		alert("Invalid file or folder name: ‘" + newName + "’");
		return;
	}
	setBusy();
	var path = makePath(fileName);
	if(moveSelections[path]) {
		delete moveSelections[path];
	}
	var cgi = "/SD_WLAN/rename.lua";
	$.get("/upload.cgi?WRITEPROTECT=ON", function() {
		$.get(cgi + "?source=" + encodeURIComponent(path) + "&name=" + encodeURIComponent(newName),
		      function(data) {
			if(data.indexOf("SUCCESS") == 0) {
				getFileList(".");
			} else {
				alert(data);
				clearBusy();
			}
		});
	});
}

function doNewDir() {
	var dirName = window.prompt("New folder name:", "");
	if(! dirName)
		return;
	var regExpInvalidChars = new RegExp(/[\/\\?%:|<>*]+/g);
	var cleanName = dirName.replace(regExpInvalidChars, "");
	if(cleanName != dirName) {
		alert("Invalid folder name: ‘" + dirName + "’");
		return;
	}
	setBusy();
	var path = makePath(dirName);
	var cgi = "/upload.cgi";
	var timestring = makeHexDate();
	$.get(cgi + "?WRITEPROTECT=ON&FTIME=" + timestring + "&UPDIR=" + encodeURIComponent(path),
	      function(data) {
		if(data.indexOf("SUCCESS") > -1) {
			getFileList(dirName);
		} else {
			alert("Error: ‘" + data + "’");
			clearBusy();
		}
	});
}

function doDelDir() {
	setBusy();
	var path = makePath(".");
	var cgi = "/upload.cgi";
	$.get(cgi + "?WRITEPROTECT=ON", function() {
		$.get(cgi + "?DEL=" + encodeURIComponent(path), function(data) {
			if(data.indexOf("SUCCESS") > -1) {
				getFileList("..");
			} else {
				alert("Error: ‘" + data + "’");
				clearBusy();
			}
		});
	});
}

function doMove() {
	// Get ready for some really hideous code.
	// The only way to move files is through a lua script. However, lua scripts can only use GET requests with a URL
	// no longer than about 155 bytes, therefore passing paths via query parameters will fail as soon as there are a
	// few files with long paths or names.
	// Hence I work around this by uploading the parameters as a fake file, and have lua read this file.
	$("#cmdMove").prop("disabled",true);
	$("#cmdMove").addClass("busy");
	var target = makePath(".");
	var query = "target=" + encodeURIComponent(target);

	// The limited capabilities of the lua interpreter make it impossible to move many files at once, so we have to
	// divide the operation in chunks. About 32 files can be moved in one go when using reasonable path lengths, so
	// I use chunks of 16 files to have some extra margin and improve responsiveness of the progress dialog.
	var count = 0;
	for(var selected in moveSelections) {
		if(++count > 16)
			break;
		query += "&source=" + encodeURIComponent(selected);
		delete moveSelections[selected];
	}
	// Only show the glass pane if the operation will take significant time.
	if(count > 6)
		setGlass("Moving files…", "");
	setGlassStatus("Left to move: " + (Object.keys(moveSelections).length + count));
	
	var argpath = "/SD_WLAN";
	// To eliminate any risk that the argfiles of two consecutive chunks have an identical name and the newer file
	// might be deleted by the clean-up of the previous operation, use millisecond timestamps. The FlashAir server
	// is almost certainly single-threaded anyway, but better safe than sorry.
	var argfile = "move_arg_" + Math.round(new Date().getTime());

	// This will do the WRITEPROTECT
	uploadDataAsFile(argpath, argfile, query, function(html) {
		if(html.indexOf("Success") == -1) {
			alert("Error while preparing move operation");
			$("#cmdMove").removeClass("busy");
			$("#cmdMove").prop("disabled",false);
			return;
		}
		if(! argpath.endsWith("/"))
			argpath += "/";
		$.get("/SD_WLAN/movefiles.lua?argfile=" + argpath + argfile, function(data) {
			$.get("/upload.cgi?DEL=" + argpath + argfile, function(data) {
				if(data.indexOf("SUCCESS") == -1) {
					console.log("Error while deleting temporary file ‘" + argpath + argfile + "’: " + data);
				}
			});
			// Checking for responses is a mess. In this case, I should not merely test on indexOf("SUCCESS") != -1,
			// because this would fail if an error occurred with a path or file that has "SUCCESS" somewhere in it.
			if(data.indexOf("SUCCESS") == 0) {
				if(Object.keys(moveSelections).length > 0)
					doMove();
				else {
					clearMove();
					clearGlass();
				}
			}
			else {
				// Abort, and leave the files that we didn't try to move selected.
				alert("Error: ‘" + data + "’");
				getFileList(".");
				clearGlass();
			}
			$("#cmdMove").removeClass("busy");
			$("#cmdMove").prop("disabled",false);
		});
	});
}

function clearMove() {
	moveSelections = {};
	$('#cmdClearMove').attr('disabled', 'disabled');
	$('#cmdClearMove').html("Clear selections");
	getFileList(".");
}

// Upload a string as a file. File name must not contain quotes or other funky characters.
function uploadDataAsFile(path, name, data, successFunc) {
	var cgi = "/upload.cgi";
	var boundary = "------0xBADC0FFEE--FunkyWorkaroundIsntIt";
	// Note that for some reason, the line separator must be CRLF. We're still dragging along typewriter legacy.
	// Also, there must be 2 bytes between data and the final \r\n--, these are always cut off.
	var body = '--' + boundary + '\r\n'
		+ 'Content-Disposition: form-data; name="file"; filename="' + name + '"\r\n'
		+ 'Content-type: text/plain\r\n\r\n'
		+ data + '\r\n\r\n'
		+ '--' + boundary + '--';
	$.get(cgi + "?WRITEPROTECT=ON&UPDIR=" + path, function() {
		$.ajax({
			url: cgi,
			type: "POST",
			processData: false,
			contentType: "multipart/form-data; boundary="+boundary,
			data: body,
			success: successFunc
		});
	});
}

function prehandleDragEvent(e)
{
	e.preventDefault();
	e.stopPropagation();
}

//Document Ready
$(function() {
	// Initialize global variables.
	currentPath = location.pathname;
	wlansd = new Array();
	moveSelections = {};
	// Show the root directory.
	getFileList('');
	// Register onClick handler for <a class="dir">
	$(document).on("click", "a.dir", function() {
		getFileList(this.text);
	});
	// Register onClick handler for move checkboxes
	$(document).on("click", "input.selectMove", function(e) {
		var fileLink = $(this).parent().parent().children(".col_file").children(".file,.dir");
		setMoveSelection(fileLink.text(), this.checked, e.shiftKey);
	});
	// Register drag/drop handlers
	$("div#content div.scrollable").on("dragover", function (e) {
		prehandleDragEvent(e);
		$(this).addClass("dragging");
	}).on("dragleave", function (e) {
		prehandleDragEvent(e);
		$(this).removeClass("dragging");
	}).on("drop", function (e) {
		prehandleDragEvent(e);
		if(e.originalEvent.dataTransfer.files.length) {
			$('#file').get(0).files = e.originalEvent.dataTransfer.files;
		}
		$(this).removeClass("dragging");
		doUpload();
	});

	// Register click for upload and folder buttons
	$("#cmdUpload").click(function(e) {
		doUpload();
		return false;
	});
	$("#cmdNewDir").click(function(e) {
		doNewDir();
		return false;
	});
	$("#cmdDelDir").click(function(e) {
		doDelDir();
		return false;
	});
	$("#cmdMove").click(function(e) {
		doMove();
		return false;
	});
	$("#cmdMultiDel").click(function(e) {
		startMultiDelete();
		return false;
	});
	$("#cmdClearMove").click(function(e) {
		clearMove();
		return false;
	});
	// Only enable upload button if something has been chosen
	$("#file").change(function(e) {
		if($("#file").val()) {
			$("#cmdUpload").prop("disabled", false);
		}
		else {
			$("#cmdUpload").prop("disabled", true);
		}
	});

	$("#version").html("FlashAirUI v" + version);
	getFWVersion();
});
