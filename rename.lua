-- Rename a file or directory.
-- Invoke the script with a 'source' parameter containing the full path to the
-- file/folder to rename, and a 'name' parameter containing the new name (without path).
-- Mind that URL length for these Lua scripts is limited to about 155 bytes (at
-- least on the version of the firmware I'm currently using), so this script cannot
-- be used with very deep directory trees or ridiculously long names.
-- Due to another quirk of the Lua server routine, spaces in file names are to be avoided,
-- although they should work for sensible file names.

-- Part of FlashAir Fancy Web Interface by Dr. Lex
-- Released under BSD 2-Clause License. See other files for license details.


function urldecode(s)
	local s = s:gsub('+', ' ')
		:gsub('%%(%x%x)', function(h)
			return string.char(tonumber(h, 16))
		end)
	return s
end

function parsequery(s)
	local ans = {}
	for k,v in s:gmatch('([^&=]-)=([^&=]+)' ) do
		ans[ k ] = urldecode(v)
	end
	return ans
end

function filename(s)
	return string.gsub(s, "^.*/", "")
end

function printHttp(s)
	print("HTTP/1.1 200 OK")
	print("Content-Type: text/plain")
	print("")
	print(s)
end


argm = arg[1]
if argm == nil then
	argm = ""
else
	-- Annoying: the query string gets split up by whitespace. This workaround allows
	-- to rename things with spaces as long as there are no two consecutive spaces.
	argm = table.concat(arg, " ")
end
-- For some reason there is a newline at the end of argm: zap it.
queryFields = parsequery(string.gsub(argm, "\n$", ""))

if queryFields.source == nil then
	printHttp("ERROR: Missing parameter 'source'")
	return
end
if queryFields.name == nil then
	printHttp("ERROR: Missing parameter 'name'")
	return
end

name = queryFields.name
source = queryFields.source

if lfs.attributes(source) == nil then
	printHttp("ERROR: source file '" .. source .. "' does not exist")
	return
end

dir = source:match("(.*/)")
-- Invoking fa.rename with a string concatenation makes the script go boom, therefore copy to separate variables. Don't ask me why.
targetPath = dir .. name
-- Avoid pointless operations, this would append '(1)' to the filename.
if source ~= targetPath then
	-- os.rename does not work and the alternative fa.rename has no return value, hence success of the operation must be tested separately
	fa.rename(source, targetPath)
	if lfs.attributes(targetPath) == nil then
		printHttp("ERROR: failed to rename '" .. source .. "' to '" .. name .. "'")
		return
	end
end

printHttp("SUCCESS")
