-- Moves one or more files to a target directory.
-- Mind that this is the first Lua script I have ever written, so it could be dodgy.
-- The normal way of calling this script would be with a URL parameter 'target' for
-- the target directory, and one or more 'source' parameters pointing to files or
-- folders to be moved into the target.
-- However, because the Lua interface of the FlashAir only accepts URLs up to about
-- 155 bytes and has no support for POST, the parameters are next to useless for
-- longer paths. Hence I faked a POST request by allowing a parameter 'argfile'
-- that overrides the others, and points to a file containing a longer query string.
-- This is an ugly hack I'm not very proud of, so don't take it as an example of
-- good practice, it is merely necessary evil.

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
		if ans[ k ] == nil then
			ans[ k ] = {urldecode(v)}
		else
			table.insert(ans[ k ], urldecode(v))
		end
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
end
-- For some reason there is a newline at the end of argm: zap it.
queryFields = parsequery(string.gsub(argm, "\n$", ""))

if queryFields.argfile ~= nil then
	local f = io.open(queryFields.argfile[1], "r")
	if f then
		argm = f:read("*all")
		f:close()
		queryFields = parsequery(string.gsub(argm, "\n$", ""))
	else
		printHttp("ERROR: cannot read argfile")
		return
	end
end

if queryFields.target == nil then
	printHttp("ERROR: Missing parameter 'target'")
	return
end
if queryFields.source == nil then
	printHttp("ERROR: Missing parameter 'source'")
	return
end

target = queryFields.target[1]
sources = queryFields.source

if string.sub(target, -1) ~= "/" then
	target = target .. "/"
end
targetDir = string.gsub(target, "/$", "")
if target ~= "/" and lfs.attributes(targetDir, "mode") ~= "directory" then
	printHttp("ERROR: Target directory '" .. targetDir .. "' does not exist")
	return
end

for i=1, #sources, 1 do
	-- Invoking fa.rename with a string concatenation makes the script go boom, therefore copy to separate variables. Don't ask me why.
	local sourcePath = sources[i]
	local targetPath = target .. filename(sources[i])
	if lfs.attributes(sourcePath) == nil then
		printHttp("ERROR: source file '" .. sourcePath .. "' does not exist, stopping move at this point")
		return
	end
	-- Avoid pointless operations, this would append '(1)' to the filename.
	if sourcePath ~= targetPath then
		-- os.rename does not work and the alternative fa.rename has no return value, hence success of the operation must be tested separately
		fa.rename(sourcePath, targetPath)
		local failure = ""
		if lfs.attributes(targetPath) == nil then
			-- Checking attributes will sometimes fail when executed too soon after rename, therefore retry.
			sleep(100)  -- sleep, the secret sauce of fixing problems that shouldn't even occur.
			if lfs.attributes(targetPath) == nil then
				failure = failure .. "[target not found]"
			end
		end
		if lfs.attributes(sourcePath) ~= nil then
			failure = failure .. "[source still exists]"
		end
		if failure ~= "" then
			printHttp("ERROR: failed to move '" .. sourcePath .. "' to '" .. targetPath .. "' " .. failure .. ". Stopping move at this point")
			return
		end
	end
end

printHttp("SUCCESS")
