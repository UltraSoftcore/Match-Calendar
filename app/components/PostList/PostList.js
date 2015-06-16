'use strict';

/**
 * @ngdoc function
 * @name MatchCalendarApp.controller:PostListCtrl
 * @description
 * # PostListCtrl
 * Controller in MatchCalendar
 */
angular.module('MatchCalendarApp')
    .controller('PostListCtrl', ['$scope', 'Posts', '$stateParams', 'HtmlNotifications', '$timeout', 'PostNotifications', 'DateTimeService', 'Hosts', 'Changelog', function ($scope, Posts, $stateParams, HtmlNotifications, $timeout, PostNotifications, DateTimeService, Hosts, Changelog) {

        $scope.posts = Posts;
        $scope.DateTime = DateTimeService;
        $scope.notifications = PostNotifications;
        $scope.Hosts = Hosts;
        $scope.Changelog = Changelog;
        $scope.showFilters = false;

        $scope.filtered = {
            posts: [],
            filters: {
                search: '',
                region: function (post) {
                    // check if it's region is set to show or not
                    return Posts.regions[post.region.toLowerCase() || 'Unknown'];
                },
                gamemode: function (post) {
                    // check if all of its gamemodes are enabled or not
                    var all = true;
                    for (var i = 0; i < post.gamemodes.length; i++) {
                        if (!Posts.gamemodes[post.gamemodes[i].toLowerCase()]) {
                            all = false;
                        }
                    }
                    return all;
                },
                teamType: function(post) {
                    return Posts.teamTypes[post.teams.type.name.toLowerCase()];
                }
            }
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
    }]);
