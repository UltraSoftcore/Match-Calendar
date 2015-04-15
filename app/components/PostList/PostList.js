'use strict';

/**
 * @ngdoc function
 * @name MatchCalendarApp.controller:PostListCtrl
 * @description
 * # PostListCtrl
 * Controller in MatchCalendar
 */
angular.module('MatchCalendarApp')
    .controller('PostListCtrl', function ($scope, Posts, $stateParams, HtmlNotifications, $timeout, PostNotifications) {

        $scope.posts = Posts;
        $scope.notifications = PostNotifications;

        $scope.filtered = {
            posts: [],
            filters: {
                search: '',
                region: function (post) {
                    // check if it's region is set to show or not
                    return Posts.regions[post.region.toLowerCase() || 'Unknown'];
                },
                gamemode: function (post) {
                    // check if any of it's gamemodes are enabled or not
                    for (var i = 0; i < post.gamemodes.length; i++) {
                        if (Posts.gamemodes[post.gamemodes[i].toLowerCase()]) {
                            return true;
                        }
                    }
                    return false;
                },
                teamType: function(post) {
                    return Posts.teamTypes[post.teams.toLowerCase()];
                }
            }
        };

        $scope.toggleFavorite = function (name) {
            var index = $scope.settings.favoriteHosts.indexOf(name);
            if (index === -1) {
                $scope.settings.favoriteHosts.push(name);
            } else {
                $scope.settings.favoriteHosts.splice(index, 1);
            }
        };

        /**
         * Changes the address of the post to 'Copied!' for a couple of seconds
         * @param post {MatchPost}
         */
        $scope.triggerCopiedMessage = function (post) {
            if (null === post.address) {
                return;
            }
            var saved = post.address;
            post.address = 'Copied!';
            $scope.$broadcast('regionCopyChange');
            $timeout(function () {
                post.address = saved;
                $scope.$broadcast('regionCopyChange');
            }, 2000);
        };

        $scope.requestPermissions = function () {
            HtmlNotifications.requestPermission().then(function () {
                HtmlNotifications.notify('Notifications Enabled!');
            });
        };

        $scope.currentPermission = function () {
            return HtmlNotifications.currentPermission();
        };

        //handle 'anchor' links to specific posts
        $scope.scrolled = false;
        $scope.$on('postsUpdated', function() {
            $timeout(function () {
                if (!$scope.scrolled) {
                    if ($stateParams.post !== null) {
                        var element = document.getElementById('post-' + $stateParams.post);
                        if (element !== null) {
                            element.scrollIntoView();
                        }
                    }
                    $scope.scrolled = true;
                }
            });
        });
    });
