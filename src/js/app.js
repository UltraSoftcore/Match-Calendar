'use strict';

var cookie_version = '1';

// Main application
angular.module('MatchCalendar', ['ui.bootstrap', 'ngCookies', 'ngSanitize', 'btford.markdown', 'ui.router', 'ngClipboard', 'angular-intro', 'vr.directives.slider', 'ngAnimate'])

    .run(['$rootScope', '$cookieStore', 'DateTimeService', function($rootScope, $cookieStore, DateTimeService) {
        $rootScope.timeOffset = DateTimeService;
        DateTimeService.resync();

        $rootScope.settings = {
            time_formats: ['12h', '24h'],
            time_zones: moment.tz.names(),
            time_zone: $cookieStore.get('time_zone') || 'Etc/UTC',
            time_format: $cookieStore.get('time_format') || '24h',
            subreddits: $cookieStore.get('subreddits') || ['ultrahardcore', 'ghowden'],
            favorite_hosts: $cookieStore.get('favorite_hosts') || ['Elllzman619'],
            tour: {
                taken: $cookieStore.get('tour.taken') || false
            },
            notify_for: $cookieStore.get('notify_for') || {},
            notification_times: $cookieStore.get('notification_times') || [{value: 600}],

            //store the version of the cookie we have so we can modify the cookie data if needed in future versions
            stored_cookie_version: $cookieStore.get('cookie_version') || cookie_version
        };

        $rootScope.$watch('settings.notification_times', function (newValue) {
            $cookieStore.put('notification_times', newValue);
        }, true);

        $rootScope.$watch('settings.notify_for', function(newValue) {
            $cookieStore.put('notify_for', newValue);
        }, true);

        $rootScope.$watch('settings.tour.taken', function(newValue) {
            $cookieStore.put('tour.taken', newValue);
        });

        $rootScope.$watchCollection('settings.favorite_hosts', function(newValue) {
            $cookieStore.put('favorite_hosts', newValue);
        });

        $rootScope.$watch('settings.time_zone', function(newValue) {
            $cookieStore.put('time_zone', newValue);
        });

        $rootScope.$watch('settings.time_format', function(newValue) {
            $cookieStore.put('time_format', newValue);
        });

        $rootScope.$watchCollection('settings.subreddits', function(newValue) {
            $cookieStore.put('subreddits', newValue);
        });
    }])

    //configuration
    .config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
        $stateProvider
            .state('list', {
                url: '/list?post',
                templateUrl: 'partials/list.html'
            })

            .state('generate', {
                url: '/generate',
                templateUrl: 'partials/generator.html',
                controller: 'HeaderGeneratorCtrl'
            })

            .state('settings', {
                url: '/settings',
                templateUrl: 'partials/settings.html',
                controller: 'SettingsCtrl'
            });

        $urlRouterProvider.otherwise('/list');
    }])

    //controller for the application
    .controller('AppCtrl', [
        '$scope',
        'RedditPostsService',
        '$cookieStore',
        '$interval',
        '$timeout',
        'HtmlNotifications',
        '$anchorScroll',
        '$q',
        '$stateParams',
        'NotifcationTimeFormat',
        '$filter',
        function($scope, RedditPostsService, $cookieStore, $interval, $timeout, HtmlNotifications, $anchorScroll, $q, $stateParams, NotifcationTimeFormat, $filter) {
        $scope.requestPermissions = function() {
            HtmlNotifications.requestPermission().then(function() {
                HtmlNotifications.notify('Notifications Enabled!');
            });
        };
        $scope.currentPermission = function() {
            return HtmlNotifications.currentPermission();
        };

        $scope.toggleFavorite = function(name) {
            var index = $scope.settings.favorite_hosts.indexOf(name);
            if(index === -1) {
                $scope.settings.favorite_hosts.push(name);
            } else {
                $scope.settings.favorite_hosts.splice(index, 1);
            }
        };

        $scope.posts = {
            posts: [],
            filteredposts: [],
            postfilter: '',
            updating: false,
            lastUpdated: null
        };
        $scope.updatePosts = function() {
            var def = $q.defer();
            $scope.posts.updatingPosts = true;
            RedditPostsService.query($scope.settings.subreddits).then(function(data) {
                $scope.posts.posts = data;
                $scope.posts.updatingPosts = false;
                $scope.posts.lastUpdated = $scope.timeOffset.currentTime();
                def.resolve();
            });
            return def.promise;
        };

        $scope.refilter = function() {
            $scope.posts.filteredposts = $filter('filter')($scope.posts.posts, $scope.posts.postfilter);
        };
        $scope.$watch('posts.postfilter', function() {
            $scope.refilter();
        });
        $scope.$watch('posts.posts', function() {
            $scope.refilter();
        });

        /**
         * Changes the address of the post to 'Copied!' for a couple of seconds
         * @param post {MatchPost}
         */
        $scope.triggerCopiedMessage = function (post) {
            if(null == post.address)
                return;
            var saved = post.address;
            post.address = 'Copied!';
            $timeout(function() {
                post.address = saved;
            }, 2000);
        };

        $scope.toggleNotifications = function(postid) {
            var notify = $scope.settings.notify_for[postid];
            if(typeof notify === 'undefined') {
                //set the last notification time to 0 to say we havn't done any
                $scope.settings.notify_for[postid] = {value: 0};
            } else {
                delete $scope.settings.notify_for[postid];
            }
        };

        $scope.willNotify = function(postid) {
            return typeof $scope.settings.notify_for[postid] !== 'undefined';
        };

        $scope.clockTick = function() {
            $scope.current_time = $scope.timeOffset.currentTime();
            if(HtmlNotifications.currentPermission() === 'granted') {
                if($scope.posts.posts.length != 0) {
                    for (var pid in $scope.settings.notify_for) {
                        if (!$scope.settings.notify_for.hasOwnProperty(pid))
                            continue;
                        (function (postid) {
                            var post = $scope.posts.posts.filter(function (mpost) {
                                if (mpost.id === postid) {
                                    return true;
                                }
                            });
                            //if the post no longer exists
                            if (post.length == 0) {
                                delete $scope.settings.notify_for[postid];
                                return;
                            }
                            angular.forEach($scope.settings.notification_times, function(notifcation_time) {
                                var notifyTime = post[0].starts - (notifcation_time.value * 1000);
                                if($scope.current_time >= notifyTime) {
                                    if($scope.settings.notify_for[postid].value < notifyTime) {
                                        var difference = post[0].starts  - $scope.current_time;
                                        HtmlNotifications.notify('Game starts in ' + NotifcationTimeFormat.translateSeconds(Math.round(difference/1000)), post[0].title);
                                        $scope.settings.notify_for[postid] = $scope.current_time;
                                    }
                                }
                            });
                        })(pid);
                    }
                }
            }
        };
        $interval($scope.clockTick, 1000);

        $scope.scrolled = false;
        $scope.updateTick = function() {
            $scope.updatePosts().finally(function() {
                $timeout(function() {
                    if(!$scope.scrolled) {
                        if($stateParams.post != null)
                            document.getElementById('post-' + $stateParams.post).scrollIntoView();
                        $scope.scrolled = true;
                    }
                });
            });
        };
        $interval($scope.updateTick, 1000 * 60);
        $scope.$watchCollection('settings.subreddits', $scope.updateTick);
    }])

    .controller('TourController', ['$scope', '$state', function($scope, $state) {

        $scope.showTour = function() {
            return $state.current.name === 'list';
        };

        $scope.setTaken = function() {
            $scope.settings.tour.taken = true;
        };

        $scope.completedEvent = function () {
            $scope.setTaken();
        };
        $scope.exitEvent = function () {
            $scope.setTaken();
        };

        $scope.introOptions = {
            steps:[
                {
                    element: '.synced-time',
                    intro: 'This is the time synced with the server',
                    position: 'bottom'
                },
                {
                    element: '.picked-timezone',
                    intro: 'The selected timezone and format to show times in',
                    position: 'bottom'
                },
                {
                    element: '.last-updated',
                    intro: 'The time the list was last updated',
                    position: 'left'
                },
                {
                    element: '.refresh-icon',
                    intro: 'Force refresh the list. The list is automatically updated every minute',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .abs-game-starts',
                    intro: 'When the game starts',
                    position: 'right'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .server-address',
                    intro: 'The server address to connect to, click on it to copy it to the clipboard',
                    position: 'right'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .anchor-link',
                    intro: 'This link will go directly to this match post if it exists in the list',
                    position: 'right'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .post-title',
                    intro: 'The name of the game',
                    position: 'bottom'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .time-posted',
                    intro: 'How long ago and how far in advance the match was posted'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .post-author',
                    intro: 'The reddit name of the match host',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .fa-reddit',
                    intro: 'Click the reddit icon to add the user to your favorite hosts list',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .server-region',
                    intro: 'The region the server is hosted in',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .fa-calendar-o',
                    intro: 'Click this to enable notifications for this game, notification timings can be found on the settings page',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .game-opens',
                    intro: 'How long until the game opens',
                    position: 'left'
                },
                {
                    element: '.list-page > accordion .panel:nth-child(2) .game-starts',
                    intro: 'How long until the game starts',
                    position: 'left'
                }
            ],
            showStepNumbers: false,
            exitOnOverlayClick: false,
            exitOnEsc: true,
            nextLabel: '<strong>Next</strong>',
            prevLabel: 'Previous',
            skipLabel: 'Exit',
            doneLabel: 'Done'
        };

        $scope.shouldAutoStart = function() {
            return false;
        }
    }])

    .controller('SettingsCtrl', ['$scope', 'NotifcationTimeFormat', function($scope, NotifcationTimeFormat) {
        $scope.addSubreddit = function(name) {
            if(name === '' || name === null || name === undefined) {
                return;
            }
            if($scope.settings.subreddits.indexOf(name) === -1) {
                $scope.settings.subreddits.push(name);
            }
        };
        $scope.removeSubreddit = function(index) {
            $scope.settings.subreddits.splice(index, 1);
        };
        $scope.removeNotificationTime = function(index) {
            $scope.settings.notification_times.splice(index, 1);
        };
        $scope.newNotificationTime = function() {
            $scope.settings.notification_times.push({value: 600});
        };
        $scope.translateSeconds =  function (duration){
            return NotifcationTimeFormat.translateSeconds(duration);
        };
    }])

    .controller('HeaderGeneratorCtrl', ['$scope', function($scope) {
        $scope.regions = {
            'AF': 'Africa',
            'AN': 'Antartica',
            'AS': 'Asia',
            'EU': 'Europe',
            'NA': 'North America',
            'OC': 'Oceania',
            'SA': 'South America'
        };

        $scope.generated = {
            opens: '',
            starts: '',
            address: '',
            title: '',
            region: ''
        };

        $scope.$watch('opens', function(newValue) {
            $scope.generated.opens = newValue.utc().format('YYYY-MM-DDTHH:mm:ssZ');
            $scope.simpleUtcOpens = newValue.utc().format('YYYY-MM-DD HH:mm UTC');
        });
        $scope.$watch('starts', function(newValue) {
            $scope.generated.starts = newValue.utc().format('YYYY-MM-DDTHH:mm:ssZ');
            $scope.simpleUtcStarts = newValue.utc().format('YYYY-MM-DD HH:mm UTC');
        });
        $scope.$watch('address', function(newValue) {
            $scope.generated.address = newValue.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
        });
        $scope.$watch('post_title', function(newValue) {
            $scope.generated.title = newValue.replace(/\[/g, '&#91;').replace(/\]/g, '&#93;');
        });
        $scope.$watch('region', function(newValue) {
            $scope.generated.region = newValue;
        });

        $scope.$watch('generated', function(newValue) {
            $scope.generatedLink = '[' + JSON.stringify(newValue) + '](/matchpost)';
        }, true);

        $scope.opens = $scope.timeOffset.currentTime();
        $scope.starts = $scope.timeOffset.currentTime();
        $scope.address = '192.168.0.1';
        $scope.post_title = 'Game Title';
        $scope.region = 'NA';
    }])

    .factory('NotifcationTimeFormat', [function() {
        return {
            translateSeconds: function (duration) {
                var hour = 0;
                var min = 0;
                var sec = 0;

                if (duration) {
                    if (duration >= 60) {
                        min = Math.floor(duration / 60);
                        sec = duration % 60;
                    }
                    else {
                        sec = duration;
                    }

                    if (min >= 60) {
                        hour = Math.floor(min / 60);
                        min = min - hour * 60;
                    }

                    if (hour < 10) {
                        hour = '0' + hour;
                    }
                    if (min < 10) {
                        min = '0' + min;
                    }
                    if (sec < 10) {
                        sec = '0' + sec;
                    }
                }
                return hour + ":" + min + ":" + sec;
            }
        }
    }])

    //a match post model
    .factory('MatchPost', ['MarkdownLinkDataService', '$rootScope', '$location', function (MarkdownLinkDataService, $rootScope, $location) {

        //regex to match <date> <UTC|UCT> - <match post>
        // the dash can have any spacing/dashes combo
        var matchPostRegex = /^(\w+ \d+ \d+:\d+)\s*(?:UTC|UCT)?\s*\[?(\w*)\]?[ -]+(.*)$/i;

        var ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(\:\d{1,5})?/g;

        function MatchPost(id, title, selftext, author, permalink, posted) {
            this.id = id;
            this.title = title;
            this.selftext = selftext;
            this.author = author;
            this.permalink = 'http://reddit.com' + permalink;
            this.posted = posted;
            this.anchorlink = '#' + $location.path() + '?post=' + id;

            this.region = null;
            this.starts = null;
            this.opens = null;
            this.address = null;
        }

        MatchPost.prototype.setRegion = function(region) {
            this.region = region;
        };

        MatchPost.prototype.setOpens = function(opens) {
            this.opens = opens;
        };

        MatchPost.prototype.setStarts = function(starts) {
            this.starts = starts;
        };

        MatchPost.prototype.setAddress = function(address) {
            this.address = address;
        };

        /**
         * @param element the raw post element from the JSON api
         * @returns {MatchPost}
         */
        MatchPost.parseData = function (element) {
            var linkData = MarkdownLinkDataService.fetch('/matchpost', element.selftext);

            var post = new MatchPost(element.id, element.title, element.selftext, element.author, element.permalink, moment(element.created_utc, 'X'));

            var parsedLink = false;
            if(linkData != null) {
                try {
                    var json = JSON.parse(linkData);

                    post.setOpens(moment(json.opens, 'YYYY-MM-DDTHH:mm:ssZ'));
                    post.setStarts(moment(json.starts, 'YYYY-MM-DDTHH:mm:ssZ'));
                    post.setRegion(json.region);
                    post.setAddress(json.address);
                    post.title = json.title;

                    parsedLink = true;
                } catch (err) {}
            }

            if(!parsedLink) {
                //fall back to old style title parsing
                var matches = matchPostRegex.exec(element.title);

                if(null == matches)
                    //post isnt formatted correctly, don't display it at all
                    return null;

                //attempt to parse the date from the post title
                post.setStarts(moment.utc(matches[1], 'MMM DD HH:mm', 'en'));

                if(matches[2] !== '')
                    post.region = matches[2];

                post.title = matches[3];

                //basic IP checking for parsed links, this will only work for IP addresses
                var ipcheck = ipRegex.exec(element.selftext);

                if(null != ipcheck) {
                    post.address = ipcheck[1];
                    if(typeof ipcheck[2] !== 'undefined' && ipcheck[2] != '' && ipcheck[2] != ':25565')
                        post.address += ipcheck[2];
                }
            }

            //if it's invalid (no parsable date) read as unparsed
            if(post.starts != null) {
                if (!post.starts.isValid()) {
                    post.starts = null;
                } else if (post.starts.diff($rootScope.timeOffset.currentTime()) < 0) {
                    //if it's in the past don't show it at all
                    return null;
                }
            }

            if(post.opens != null) {
                //if it's invalid (no parsable date) read as unparsed
                if (!post.opens.isValid()) {
                    post.opens = null;
                }
            }

            //fix &amp;
            post.title = post.title.replace(/&amp;/g, '&');

            return post;
        };

        //Return the constructor function
        return MatchPost;
    }])

    //service for matching markdown links to specific URL path
    .factory( 'MarkdownLinkDataService', [function() {
        return {
            /**
             * Returns the raw string for the markdown link in format [data](link)
             * @param path {string} the URL that was linked to
             * @param markdown {string} the markdown
             * @returns {string} data for the link
             */
            fetch: function(path, markdown) {
                //simple regex for [data](/link) type links
                var regex = new RegExp('\\[([^\\[\\]]+)\\]\\('+path+'\\)', 'g');
                var matches = regex.exec(markdown);
                if(matches == null) {
                    return null;
                } else {
                    return matches[1];
                }
            }
        }
    }])

    //service for fetching reddit posts from the JSON api
    .factory( 'RedditPostsService', ['$http', '$q', '$filter', 'MatchPost', function( $http, $q, $filter, MatchPost ) {
        return {
            //fetch all
            query: function (subreddits, limit, sort) {
                //set defaults
                limit = limit || 100;
                sort = sort || 'new';

                var deferreds = [];
                angular.forEach(subreddits, function(subreddit) {
                    var deferred = $q.defer();

                    var parsed = [];
                    var unparsed = [];
                    //get the posts
                    $http.get('https://www.reddit.com/r/' + subreddit + '/search.json?q=flair%3AUpcoming_Match&restrict_sr=on&limit=' + limit + '&sort=' + sort).then(
                        function(data) {
                            angular.forEach(data.data.data.children, function(element) {
                                //parse the post
                                var matchPost = MatchPost.parseData(element.data);

                                if(null == matchPost) {
                                    return;
                                }

                                //if time was invalid push to the invalid stack
                                matchPost.starts == null ? unparsed.push(matchPost) : parsed.push(matchPost);
                            });
                            deferred.resolve({
                                parsed: parsed,
                                unparsed: unparsed
                            });
                        },
                        function() {
                            deferred.resolve({
                                parsed: parsed,
                                unparsed: unparsed
                            });
                        }
                    );
                    deferreds.push(deferred.promise);
                });

                var deferred = $q.defer();
                $q.all(deferreds).then(function(data) {
                    var parsed = [];
                    var unparsed = [];
                    angular.forEach(data, function(element) {
                        parsed.push.apply(parsed, element.parsed);
                        unparsed.push.apply(unparsed, element.unparsed);
                    });

                    //filter the parsed ones in time order
                    var filtered = $filter('orderBy')(parsed, function(element) {
                        return element.starts.format('X');
                    });

                    //add the unparsed matches to the end
                    filtered.push.apply(filtered, unparsed);
                    deferred.resolve(filtered);
                });

                return deferred.promise;
            }
        };
    }])

    .factory('HtmlNotifications', ['$q', function($q) {
        return {
            /**
             * @returns boolean true if notification available, false otherwise
             */
            supports: function() {
                return "Notification" in window;
            },
            currentPermission: function() {
                if(!Notification.permission) {
                    Notification.permission = 'default';
                }
                return Notification.permission;
            },
            /**
             * @returns {promise} resolves on granted, rejects on not
             */
            requestPermission: function() {
                var def = $q.defer();
                if(Notification.permission !== 'granted') {
                    //request the permission and update the permission value
                    Notification.requestPermission(function (status) {
                        if (Notification.permission !== status) {
                            Notification.permission = status;
                        }
                        status === 'granted' ? def.resolve() : def.reject();
                    });
                } else {
                    def.resolve();
                }
                return def.promise;
            },
            /**
             * @param title the title for the notification
             * @param options
             * @param body the body of the notification
             */
            notify: function(title, body, options) {
                this.requestPermission().then(function() {
                    options = options || [];
                    options.icon = options.icon || 'images/favicon.png';
                    options.body = body || '';

                    new Notification(title, options);
                });
            }
        };
    }])

    .factory('DateTimeService', ['$http', function($http) {
        var resyncURL = 'sync.php';

        return {
            synced: false,
            offset: null,
            resync: function() {
                var service = this;
                $http.get(resyncURL).then(
                    function(data) {
                        service.synced = true;
                        //this isn't really that accurate but within ping time so close enough
                        service.offset = data.data.time - moment().valueOf();
                    }
                );
            },
            currentTime: function() {
                var current = moment();
                if (this.synced) {
                    current.add('ms', this.offset);
                }
                return current;
            }
        }
    }])

    .directive('dateTimePicker', [function() {
        return {
            restrict: 'AE',
            scope: {
                minDate: '=?',
                pickedDate: '=',
                meridian: '=',
                timeZone: '='
            },
            templateUrl: 'partials/dateTimePicker.html',
            link: function($scope, $element, $attr) {
                $scope.opened = false;

                $scope.internalJSDate = $scope.pickedDate.toDate();
                $scope.internalMinDate = $scope.minDate.toDate();

                $scope.$watch('internalJSDate', function() {
                    $scope.updatePickedDate();
                });
                $scope.$watch('timeZone', function() {
                    $scope.updatePickedDate();
                });

                $scope.updatePickedDate = function() {
                    var pickedMoment = moment($scope.internalJSDate);
                    var formattedMoment = pickedMoment.format('MMM DD HH:mm');
                    $scope.pickedDate = moment.tz(formattedMoment, 'MMM DD HH:mm', $scope.timeZone);
                };

                $scope.toggle = function($event) {
                    $event.preventDefault();
                    $event.stopPropagation();
                    $scope.opened = !$scope.opened;
                }
            }
        }
    }])

    //directive with keybind="expression()" key=13
    .directive('keybind', function() {
        return function(scope, element, attrs) {
            element.bind("keydown keypress", function(event) {
                if(event.which === Number(attrs.key)) {
                    scope.$apply(function(){
                        scope.$eval(attrs.keybind);
                    });

                    event.preventDefault();
                }
            });
        };
    });