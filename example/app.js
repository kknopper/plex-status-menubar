var Handlebars = require('handlebars');
window.jQuery = window.$ = require('jquery');
var storage = require('electron-json-storage');
// var menubar = require('menubar')
// var mb = menubar()
var ipcRenderer = require('electron').ipcRenderer;
console.log(ipcRenderer.sendSync('synchronous-message', 'ping')); // prints "pong"
ipcRenderer.on('asynchronous-reply', function(event, arg) {
  console.log(arg); // prints "pong"
});


//TODO
//GET PlexQuery ajax call working


var $un = $('#username')
var $pass = $('#password')
// var $serverIp = $('#server-ip')
var token
var serverInterval = 1000 * 30; // 30s between server ping
var url = 'http://';
// var ipAddressRef =  '71.84.24.194:32400'

var settings = {
  'isActive' : false,
  'userCount': '0',
  'plexServerPort': ':32400',
  'loggedIn': false
}

// storage.has('username', function(error, hasKey) {
//   if (error) throw error;
//
//   if (hasKey) {
//     console.log('SETTINGS HAVE BEEN SAVED');
//     storage.get('username', function(error,data) {
//       if (error) throw error;
//       else { settings.username = data }
//         console.log(data)
//     })
//     storage.get('password', function(error,data) {
//       if (error) throw error;
//       else { settings.password = data }
//         console.log('password here')
//     })
//     storage.get('server', function(error,data) {
//       if (error) throw error;
//       else { settings.serverIp = url + data }
//         console.log(data)
//         console.log(settings.serverIp)
//     })
//     console.log(settings)
//     setTimeout(function() {
//       getPlexToken(settings)
//       console.log("SET TIMEOUT")
//     }, 5000)
//   }
// });

function getPlexToken(userSettings) {
  $.ajax({
      url: 'https://plex.tv/users/sign_in.json',
      type: 'POST',
      dataType: 'json',
      beforeSend: function (json) {
        json.setRequestHeader ("Authorization", "Basic " + btoa(userSettings.username + ":" + userSettings.password));
      },
      headers: {
        'X-Plex-Platform': 'MacOSX',
        'X-Plex-Platform-Version': '10.10.5',
        'X-Plex-Provides': '1',
        'X-Plex-Client-Identifier': 'Plex Server Status Monitor',
        'X-Plex-Product': 'Plex Server Status Monitor',
        'X-Plex-Version': '1.0',
        'X-Plex-Device': 'Max OSX',
        'X-Plex-Device-Name': 'Plex Web'
      }
    })
    .done(function(data) {
      console.log("PLEX TOKEN ACQUIRED.", data)
      token = data.user.authentication_token;
      settings.plexToken = token;
      console.log("PLEX TOKEN: ", token);
      settings.loggedIn = true;

      // plexQuery(url, token)
      $('#login').hide()

      getPlexIp(token);
    })
    .fail(function(data) {
      console.log("FAIL!!!!", data)
    })
    .always(function() {
      console.log("Get Plex Token Complete");
    });
}

function getPlexIp(token) {
  var ip;
  $.ajax({
      url: 'https://plex.tv/api/resources?X-Plex-Token=' + token,
      type: 'GET',
      dataType: 'xml'
    })
    .done(function(data) {
      console.log("Get Plex Ip Done");
      var jsonData = xmlToJson(data)

      //Set Device data to an array in case user has more than 1 server objects
      if (!Array.isArray(jsonData.MediaContainer.Device)) {
        jsonData.MediaContainer.Device = [jsonData.MediaContainer.Device];
      }

      for ( i=0; i < jsonData.MediaContainer.Device.length; i++ ) {
        if (jsonData.MediaContainer.Device[i]['@attributes'].accessToken == token) {
          //Set Connection data to an array in case user has more than 1 connection objects
          if (!Array.isArray(jsonData.MediaContainer.Device[i].Connection)) {
            jsonData.MediaContainer.Device[i].Connection = [jsonData.MediaContainer.Device[i].Connection];
          }

          for ( j=0; j < jsonData.MediaContainer.Device[i].Connection.length; j++ ) {
            // console.log(jsonData.MediaContainer.Device[i].Connection[j]);
            // console.log(jsonData.MediaContainer.Device[i].Connection[j]['@attributes'].local);

            if (jsonData.MediaContainer.Device[i].Connection[j]['@attributes'].local == '0') {
              ip = jsonData.MediaContainer.Device[i].Connection[j]['@attributes'].uri;
              console.log("MY SERVER IP ADDRESS: ", ip);
              break;
            }
          }
        }
        //Make Another break here if ip variable has a length??
      }

      plexQuery(ip, token);

    })
    .fail(function(data) {
      console.log("FAIL!!!!", data);
    })
    .always(function() {
      console.log("Get Plex Ip Complete");
    });
}

function plexQuery(ip, token) {
  if (settings.loggedIn == false) {
    return;
  }
  console.log("PLEX QUERY START", ip, token)
  console.log(ip + '/status/sessions'+ '?X-Plex-Token='+ token)
  console.log("SETTINGS: ", settings)
  $.ajax({
    //url: ip + '/status/sessions?X-Plex-Token=' + token,
    url: ip + '/status/sessions',
    type: 'GET',
    dataType: 'json',
    headers: {
      'Accept': 'application/json',
      'X-Plex-Token': token
    }

  })
  .done(function(data) {
    console.log("PLEX QUERY SUCCESS")
    console.log(data);
    // var jsonData = xmlToJson(data)
    // console.log(jsonData)

    setHandleBarData(ip, token, data)
    console.log('LoggedIn: ', settings.loggedIn)
      console.log("PING SERVER EVERY 30 seconds")
      console.log("SERVER INTERVAL:", serverInterval);
      setTimeout(function() {
        plexQuery(ip, token);
      }, serverInterval);
      // console.log("AFTER TIMEOUT")

    // $('#test-image').attr('src', url + jsonData.MediaContainer.Video['@attributes'].art + '?X-Plex-Token=' + token);
  })
  .fail(function(data) {
    console.log("PLEX QUERY ERROR!");
    console.log(data);
  })
  .always(function() {
    console.log("PLEX QUERY RUN");
  });
}

function setHandleBarData(url, token, data) {
  var mediaInfo = [];
  console.log(data._children);
  // console.log(data.MediaContainer['@attributes'].size);
  if (data._children.size == 0) {
    $('#user-section').html('<h1>No Active Users :)</h1>')
    settings.isActive = false;
    settings.userCount = '0';
    ipcRenderer.send('asynchronous-message', settings);

    return;
  }

  else {
    console.log(data);
    console.log(data._children);


    // if (!Array.isArray(data.MediaContainer.Track)) {
    //   //IF NOT ARRAY MAKE IT AN ARRAY!
    //   data.MediaContainer.Track = [data.MediaContainer.Track];
    // }

    // for (var i=0; i<data._children.length; i++) {
    //
    // }

    //MOVIE / TV SHOW DATA
    // if (!Array.isArray(data.MediaContainer.Video)) {
    //   //IF NOT ARRAY MAKE IT AN ARRAY!
    //   data.MediaContainer.Video = [data.MediaContainer.Video];
    // }
    for (var i=0; i<data._children.length; i++) {
      var mediaDuration = msToTime(data._children[i].duration)
      var mediaOffset = msToTime(data._children[i].viewOffset)
      var mediaPercentWatched = ((data._children[i].viewOffset) / (data._children[i].duration) * 100)

      console.log("MOVIE DURATION: ", mediaDuration)
      console.log("MOVIE WATCHED: ", mediaOffset)
      console.log(data._children[i]._children)
      if (Array.isArray(data._children[i]._children)) {
        console.log(data._children[i]._children)
        for (var j=0; j<data._children[i]._children.length; j++) {
          console.log(data._children[i]._children[j]._elementType)
          if (data._children[i]._children[j]._elementType == 'User') {
            mediaInfo.push({
              mediaTitle: data._children[i].title,
              userThumb: data._children[i]._children[j].thumb,
              userName: data._children[i]._children[j].title,
              mediaImg: url + data._children[i].art + '?X-Plex-Token=' + token,
              mediaYear: data._children[i].year,
              mediaDuration: mediaDuration,
              mediaOffset: mediaOffset,
              mediaTimeLeft: mediaPercentWatched + '%'
            });
            break;
          }
        }
        // data._children[i]._children = {data._children[i]._children}
      }

    }
    var templateSource = $("#active-users").html();
    var template = Handlebars.compile(templateSource);
    var html = template(mediaInfo);
    // console.log("HTMLLL",html, "template source", templateSource, template)
    $('#user-section').html(html)
    $('#logout-button').show();
    settings.isActive = true
    settings.userCount = String(i)
    ipcRenderer.send('asynchronous-message', settings);
  }
}


//RUN ON CLICK

$('#login').submit(function(e) {
  settings.username = $un.val()
  settings.password = $pass.val()
  // settings.serverIp = $serverIp.val()

  storage.set('username', settings.username)
  storage.set('password', settings.password)
  // storage.set('server', settings.serverIp)

  storage.has('username', function(error, hasKey) {
    if (error) throw error;

    if (hasKey) {
      console.log('There is data stored as `username`');
    }
  });

  setTimeout(function() {
    console.log("Login Start");
    getPlexToken(settings);
  }, 5000);
  e.preventDefault();
});

$('#login-button').click(function() {
  $('#login').submit();
});


$('#logout-button').click(function() {
  console.log('logout');
  $('#user-section').html('');
  $(this).hide();
  $('#login').show();
  settings.loggedIn = false;
  settings.isActive = false;
  settings.userCount = 0;
  ipcRenderer.send('asynchronous-message', settings);

});
