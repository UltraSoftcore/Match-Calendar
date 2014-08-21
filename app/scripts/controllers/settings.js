'use strict';

/**
 * @ngdoc function
 * @name matchCalendarApp.controller:SettingsCtrl
 * @description
 * # SettingsCtrl
 * Controller of the matchCalendarApp
 */
angular.module('matchCalendarApp')
    .controller('SettingsCtrl', ['$scope', 'NotifcationTimeFormat', function ($scope, NotifcationTimeFormat) {
        $scope.addSubreddit = function (name) {
            if (name === '' || name === null || name === undefined) {
                return;
            }
            if ($scope.settings.subreddits.indexOf(name) === -1) {
                $scope.settings.subreddits.push(name);
            }
        };
        $scope.removeSubreddit = function (index) {
            $scope.settings.subreddits.splice(index, 1);
        };
        $scope.removeNotificationTime = function (index) {
            $scope.settings.notification_times.splice(index, 1);
        };
        $scope.newNotificationTime = function () {
            $scope.settings.notification_times.push({value: 600});
        };
        $scope.translateSeconds = function (duration) {
            return NotifcationTimeFormat.translateSeconds(duration);
        };
    }]);