# FlashAir File Interface by DrLex
by Alexander Thomas, aka Dr. Lex<br>
Current version: 1.0<br>
Contact: visit https://www.dr-lex.be/lexmail.html<br>
&nbsp;&nbsp;&nbsp;&nbsp;or use my gmail address "doctor.lex".

## What is it?
This is a simple but quite feature-complete web UI for the Toshiba FlashAir W-03 wireless SD card. It allows uploads, renaming, moving, and deleting files. It is specifically designed to be used with 3D printers, where it is usually only necessary to upload only a few files at a time, and either erase them after the print has completed, or move them to an archive directory.

Due to various limitations of the FlashAir, I had to be somewhat creative to make certain things work. For instance, the move operation is performed by a Lua script, which reads the list of files to be moved from a text file that is uploaded to the card, because the Lua HTTP interface is simply way too limited to pass even only one complete file path through URL parameters only. In other words, this is a pile of mostly ugly hacks, but they do the job.

The code is based on the FlashAir tutorial from Toshiba, which is released under a BSD 2-Clause License, hence this entire project is released under the same license. The whole thing is an ugly mix of HTML, CSS, JavaScript, JQuery, and Lua scripts.


## How to install
Basically, just dump almost all the files in the /SD_WLAN directory on your FlashAir, with a few modifications. This directory may be hidden if you browse the card in Windows, so you will need to change settings to show hidden files and directories.

Also download the latest compressed, production jQuery from http://jquery.com/download/, rename the file to ‘jquery.js’, and place it in /SD_WLAN/js/ on the card.

You need to choose whether you want to use the card in Access Point (AP) mode, or client mode. I highly recommend client mode, because uploading files in AP mode seems to be horribly slow for some reason.
Copy either the CONFIG-AP or CONFIG-client file to SD_WLAN, and rename it to CONFIG. Edit the file in a text editor, and change the following values.

### In case of client mode:
* ID: anything you want (is supposed to set the name for netbios or Bonjour, but I haven't seen this work in my setup).
* DHCP_Enabled: if you set it to YES, the card will get an IP address from your router. If you can access the card through its ID set above, this will be OK. However, if you want to access it by IP address, it will be more practical to ensure it always gets the same address. Either configure your router to always hand out the same address to the card's MAC, or set DHCP_Enabled to NO and fill in the values for IP_Address, Subnet_Mask, etc.
* APPSSID: the SSID of the WiFi network the card needs to connect to. If you have multiple access points, pick the one the card will be closest to. IMPORTANT: your access point must be set to channel 11 or lower. The card cannot connect to channels 12 and 13, at least not the version I have.
* APPNETWORKKEY: the password for your WiFi. When the card has booted once, this value will be overwritten with asterisks so nobody can easily read your password from the card should they get hold of it.
* APPAUTOTIME: this is the time in seconds the card will keep the WiFi connection running after it has booted. Rumours are that this value is irrelevant in client mode and the card stays connected, but you may want to enter a big value here just to be sure.

### In case of AP mode:
* APPSSID: the SSID you want to card to advertise.
* APPNETWORKKEY: the password for accessing the card's network. As with client mode, the value will be obfuscated when the card boots, so don't forget what you entered here.
* APPAUTOTIME: similar as above, but for AP mode this value really counts. The idea is that for battery-powered devices the card should shut off within reasonable time, but for a mains-powered 3D printer you'll again want to use a large value here.
* APPCHANNEL: the WiFi channel the card should operate on. Again, I suspect that the card only supports channels up to 11.


## How to use
After installing and configuring the card, unplug it and insert it into the device you want to use it in.

If you have set up the card in client mode, enter http://yourCardsAddress/ in a browser, where ‘yourCardsAddress’ is either the ID you configured, or the IP_Address if you disabled DHCP. If you use it in AP mode, connect to the card's wifi network, and go to http://192.168.0.1/.

The interface is quite straightforward, although moving files probably doesn't work the way you're used to from a typical Windows or Mac OS interface. Instead, it works more like the Android file browser: click the checkboxes to the left of the files you want to move, go to the directory where you want them to end up, and then click the ‘Move selections here’ button. You can select multiple files in multiple different folders at once.
The ‘⨂’ icon deletes a file, the pencil (✎) icon allows to rename it. If you don't see these icons, you need a more Unicode-compliant browser or computer, the same goes for the file and folder icons (🗒, 📁) which are all plain Unicode characters.

To upload a file, go to the folder where you want it, click the ‘Choose file’ button, and then ‘Upload’. You can only upload one file at a time.

Folders can only be deleted when they are empty, by using the ‘Delete empty folder’ button.

### Limitations
As soon as you have made any modification to the filesystem through the web interface, e.g. uploaded, moved, renamed, or deleted a file, the device the card is mounted in can no longer write to the card. It might appear as if writing works, but any changes will be lost. The idea is that you do everything through this web UI, and only read files on the device containing the card. You must force the device to re-read the card every time you have made any change to it.

Some things you should **not** try in the web UI because they are likely to fail:
1. Don't try to do any other write operation while an upload is still ongoing. In fact, trying anything at all while uploading might cause the upload or other operation to fail. This is why using the card in AP mode is a bad idea because uploads can take ages.
2. Don't keep piling up an insane amount of files in a single directory. At some point the limited CGI interface of the FlashAir will probably bump into a limit. Spread files over multiple directories.
3. Don't make deep directory trees. Renaming or deleting files with extremely long filesystem paths will fail.
4. Don't use multiple consecutive spaces in file names. This will cause certain operations to fail due to limitations of the Lua interface.
