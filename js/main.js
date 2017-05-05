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
// Callback Function for sort()
function cmptime(a, b) {
	if( a["fdate"] == b["fdate"] ) {
		return a["ftime"] - b["ftime"];
	}else{
		return a["fdate"] - b["fdate"];
	}
}

function escapeString(str) {
	return (str + '').replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
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

function setBusy() {
	$("#header").children("h1").addClass("busy");
}

function clearBusy() {
	$("#header").children("h1").removeClass("busy");
}

// Show file list
function showFileList(path) {
	// Clear box.
	$("#list").html('');

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
	// Output a link to the parent directory if it is not the root directory.
	if(path != "/") {
		table.append(
			$("<tr></tr>").append($("<td></td>").addClass("col_file").append(
				$('<a href="javascript:void(0)" class="dir">..</a>')
			))
		);
	}
	var isEmpty = true;
	var pathSlashed = path;
	if(! path.endsWith("/"))
		pathSlashed += "/";
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
		} else {
			fileLink.addClass("file").attr('href', file["r_uri"] + '/' + file["fname"]).attr("target","_blank");
			delLink.addClass("del").attr('href', 'javascript:doDelete("' + escapeString(file["fname"]) + '")');
			delLink.append('⨂');
			filesize = fancyFileSize(file["fsize"]);
		}
		renLink.attr('href', 'javascript:doRename("' + escapeString(file["fname"]) + '")');
		renLink.append('✎');
		// Append a file entry or directory to the end of the list.
		var row = $("<tr></tr>");
		var checkbox = $('<input type="checkbox">').addClass("selectMove");
		if(moveSelections[pathSlashed + file["fname"]])
			checkbox.prop('checked', true);
		row.append($("<td></td>").addClass("col_file").append(checkbox).append(fileLink.append(caption)));
		row.append($("<td></td>").addClass("col_size").append(filesize));
		row.append($("<td></td>").addClass("col_del").append(delLink));
		row.append($("<td></td>").addClass("col_ren").append(renLink));
		table.append(row);
	});
	$("#list").append(table);
	if(isEmpty)
		$('#cmdDelDir').removeAttr('disabled');
	else {
		$('#cmdDelDir').attr('disabled', 'disabled');
	}
	checkMoveAllowed(path);
	clearBusy();
}

//Making Path
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
		// Sort by date and time.
		wlansd.sort(cmptime);
		// Show
		showFileList(currentPath);
		showFreeSpace(wlansd.length);
	});
}

//Update set of files selected for moving
function setMoveSelection(name, checked) {
	var path = makePath(".");
	if(path != "/")
		path += "/";
	var fullPath = path + name;
	if(checked)
		moveSelections[fullPath] = true;
	else if(moveSelections[fullPath]) {
		delete moveSelections[fullPath];
	}
	checkMoveAllowed(path);
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
	if(isEmpty)
		$('#cmdClearMove').attr('disabled', 'disabled');
	else {
		$('#cmdClearMove').removeAttr('disabled');
	}
	if(!isEmpty && moveAllowed)
		$('#cmdMove').removeAttr('disabled');
	else {
		$('#cmdMove').attr('disabled', 'disabled');
	}
}

//UploadProcess
function doUpload() {
	var path = makePath(".");
	var cgi = "/upload.cgi";
	var timestring;
	var dt = new Date();
	var year = (dt.getFullYear() - 1980) << 9;
	var month = (dt.getMonth() + 1) << 5;
	var date = dt.getDate();
	var hours = dt.getHours() << 11;
	var minites = dt.getMinutes() << 5;
	var seconds = Math.floor(dt.getSeconds() / 2);
	timestring = "0x" + (year + month + date).toString(16) + (hours + minites + seconds).toString(16);
	$("#cmdUpload").prop("disabled",true);
	$("#cmdUpload").html('Uploading…');
	$("#cmdUpload").addClass("busy");
	$.get(cgi + "?WRITEPROTECT=ON&UPDIR=" + path + "&FTIME=" + timestring, function() {
		var uploadFile = $('#file')[0].files[0];
		var fd = new FormData();
		fd.append("file", uploadFile);
		$.ajax({ url: cgi,
			type: "POST",
			data: fd,
			processData: false,
			contentType: false,
			success: function(html) {
				$("#cmdUpload").removeClass("busy");
				$("#cmdUpload").html('Upload');
				$("#cmdUpload").prop("disabled",false);
				if(html.indexOf("Success") > -1)
					getFileList(".");
				else {
					alert("Error");
				}
			}
		});
	});
	return false;
}

//Delete a file
function doDelete(fileName) {
	setBusy();
	var path = makePath(".");
	var fullPath = path + '/' + fileName;
	var cgi = "/upload.cgi";
	$.get(cgi + "?WRITEPROTECT=ON", function() {
		$.get(cgi + "?DEL=" + encodeURIComponent(fullPath), function(data) {
			if(data.indexOf("SUCCESS") > -1) {
				if(moveSelections[fullPath])
					delete moveSelections[fullPath];
				getFileList(".");
			} else {
				alert("Error: ‘" + data + "’");
				clearBusy();
			}
		});
	});
	return false;
}

// Rename a file or folder
function doRename(fileName) {
	var newName = window.prompt("New name:", "");
	if(! newName)
		return;
	var regExpInvalidChars = new RegExp(/[\/\\?%:|<>*]+/g);
	var cleanName = newName.replace(regExpInvalidChars, "");
	if(cleanName != newName) {
		alert("Invalid file or folder name: ‘" + newName + "’");
		return;
	}
	setBusy();
	var path = makePath(".");
	var cgi = "/SD_WLAN/rename.lua";
	$.get(cgi + "?source=" + encodeURIComponent(path + '/' + fileName) + "&name=" + encodeURIComponent(newName), function(data) {
		if(data.indexOf("SUCCESS") == 0) {
			getFileList(".");
		} else {
			alert(data);
			clearBusy();
		}
	});
	return false;
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
	var path = makePath(".");
	var cgi = "/upload.cgi";
	$.get(cgi + "?UPDIR=" + encodeURIComponent(path + '/' + dirName), function(data) {
		if(data.indexOf("SUCCESS") > -1) {
			getFileList(dirName);
		} else {
			alert("Error: ‘" + data + "’");
			clearBusy();
		}
	});
	return false;
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
	return false;
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
	
	for(var selected in moveSelections) {
		query += "&source=" + encodeURIComponent(selected);
	}
	var argpath = "/SD_WLAN";
	var argfile = "move_arg_" + Math.round(new Date().getTime() / 1000);
	
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
			// Checking for responses is a mess. In this case, I should not test on indexOf("SUCCESS") != -1,
			// because this would fail if an error occurred with a path or file that has "SUCCESS" somewhere in it.
			if(data.indexOf("SUCCESS") == 0)
				clearMove();
			else {
				alert("Error: ‘" + data + "’");
			}
			$("#cmdMove").removeClass("busy");
			$("#cmdMove").prop("disabled",false);
			$.get("/upload.cgi?DEL=" + argpath + argfile, function(data) {
				if(data.indexOf("SUCCESS") == -1) {
					console.log("Error while deleting temporary file ‘" + argpath + argfile + "’: " + data);
				}
			});
		});
	});
}

function clearMove() {
	moveSelections = {};
	$('#cmdClearMove').attr('disabled', 'disabled');
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


//Document Ready
$(function() {
	// Initialize global variables.
	currentPath = location.pathname;
	wlansd = new Array();
	moveSelections = {};
	// Show the root directory.
	getFileList('');
	// Register onClick handler for <a class="dir">
	$(document).on("click","a.dir",function() {
		getFileList(this.text);
	});
	// Register onClick handler for move checkboxes
	$(document).on("click","input.selectMove",function() {
		var fileLink = $(this).closest(".col_file").children(".file,.dir");
		setMoveSelection(fileLink.text(), this.checked);
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
	$("#cmdClearMove").click(function(e) {
		clearMove();
		return false;
	});
});
