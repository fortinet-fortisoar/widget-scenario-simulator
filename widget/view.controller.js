/* Copyright start
  MIT License
  Copyright (c) 2026 Fortinet Inc
  Copyright end */
'use strict';
(function () {
  angular
    .module('cybersponse')
    .controller('scenarioSimulator100Ctrl', scenarioSimulator100Ctrl);

  scenarioSimulator100Ctrl.$inject = ['$scope', 'Entity', 'playbookService', 'widgetBasePath', 'websocketService', '$timeout', 'markdownEditorService', '$q', 'scenarioSimulatorService' , '$rootScope', 'translationService', 'currentPermissionsService'];

  function scenarioSimulator100Ctrl($scope, Entity, playbookService, widgetBasePath, websocketService, $timeout, markdownEditorService, $q, scenarioSimulatorService, $rootScope, translationService, currentPermissionsService) {
    const CURRENT_MODULE = 'scenario';
    $scope.currentTheme = $rootScope.theme.id + '_scenarioSimulator';
    $scope.scenarioPermissions = currentPermissionsService.getPermission('scenario');
    $scope.playbookPermission = currentPermissionsService.getPermission('workflows');

    let entity = new Entity(CURRENT_MODULE);
    let websocketProcessingTime = new Date();
    const websocketThresholdTime = 10000;//10 seconds threshold set to refresh grid
    let webSocketSubscription;
    let delayTimer;
    let destroyCollection; 
    const iconPath = widgetBasePath + 'widgetAssets/images/noImage.png';
    $scope.scenarioData = [];
    $scope.totalItems = 0;

    $scope.fetchMDDescription = fetchMDDescription;
    $scope.config = { 'searchText': '' };

    $scope.actionPlaybooks = {
      runScenario: {
        'id': '/api/3/workflows/a10522ac-2622-40bd-ad79-4487d9a1d7d7',
        'name': translationService.instantTranslate('scenarioSimulator.BTN_RUN_SCENARIO'),
        'icon': 'fa fa-play',
        'btnClass': 'btn-primary'
      },
      resetScenario: {
        'id': '/api/3/workflows/98506caa-32ab-429d-9c0f-42d92a71b5d1',
        'name': translationService.instantTranslate('scenarioSimulator.BTN_RESET_SCENARIO'),
        'icon': 'fa fa-repeat',
        'btnClass': 'btn-default'
      }
    };

    function init() {
      $scope.loadingData = true;
      if ($scope.scenarioPermissions.read) {
        entity.loadFields().then(function () {
          populateData();
        });
      }
    }

    function populateData(entityUuid) {
      scenarioSimulatorService.fetchData(CURRENT_MODULE, $scope.config.searchText, entityUuid).then(function (response) {
            if (entityUuid) {
            // API returned a single scenario
            const scenario = response.data['hydra:member'][0];
            scenario.descriptionHtml = markdownEditorService.mdToHTML(scenario.description);
            scenario.expanded = false;
            scenario.icon = scenario.icon || `<img src="${iconPath}"/>`;
            const index = $scope.scenarioData.findIndex(function (item) {
              return item.uuid === entityUuid;
            });
            if (index !== -1) {
              $scope.scenarioData[index] = scenario;
            }
          } else {
            // API returned the full list
            $scope.loadingData = true;
            const data = response.data['hydra:member'];
            $scope.totalItems = response.data['hydra:totalItems'];

            data.forEach(function (scenario) {
              scenario.descriptionHtml = markdownEditorService.mdToHTML(scenario.description);
              scenario.expanded = false;
              scenario.icon = scenario.icon || `<img src="${iconPath}"/>`;
            });

            $scope.scenarioData = data;
          }

          $timeout(function () {
            const elements = document.querySelectorAll('.mdEditor');
            angular.forEach(elements, function (el, index) {
              if ($scope.scenarioData[index]) {
                $scope.scenarioData[index].showViewMore =
                  el.scrollHeight > el.clientHeight;
              }
            });
            $scope.$applyAsync();
            if (!webSocketSubscription) {
              initWebsocket();
            }
          });
        })
        .finally(function () {
          $scope.loadingData = false;
        });
    }

    function fetchMDDescription(description) {
      return markdownEditorService.mdToHTML(description);
    }

    //to explicitly fetch the action item
    function initWebsocket() {
      websocketService.subscribe(CURRENT_MODULE, function (data) {
        if (data.sourceWebsocketId !== websocketService.getWebsocketSessionId()) {
          if (data.operation === 'update') {
            if (data.changeData && data.changeData.length > 0) {
              let foundField;
              const found = _.find($scope.scenarioData, function (scenario) {
                return data.entityUuid.indexOf(scenario['@id']) >= 0;
              });
              if (found) {
                const _mapKeys = ['title', 'description', 'createdAlertsID', 'recordTags'];
                foundField = _mapKeys.some(item => data.changeData.includes(item));
              }
              if (foundField || data.changeData.indexOf('deletedAt') >= 0) {
                websocketRefresh(found['uuid']);
              }
            }
          }
        }
      }
      ).then(function (data) {
        webSocketSubscription = data;
      });
    }

    $scope.searchContent = function () {
      populateData();
    }

    function websocketRefresh(entityId) {
      if (websocketThresholdTime < (new Date().getTime() - websocketProcessingTime.getTime())) {
        websocketProcessingTime = new Date();
        populateData(entityId);
      } else {
        $timeout.cancel(delayTimer);
        delayTimer = $timeout(function () {
          populateData(entityId);
        }, 5000);
      }
    }

    $scope.$on('popupClosed', function (data) {
      if (data === $scope.config.name + '_' + $scope.config.version) {
        unsubscribe();
      }
    });

    $scope.$on('popupOpened', function (data) {
      $scope.fullRefresh();
      initWebsocket();
    });

    function unsubscribe() {
      $timeout.cancel(delayTimer);
      if (webSocketSubscription) {
        websocketService.unsubscribe(webSocketSubscription);
        webSocketSubscription = undefined;
      }
    }

    $scope.$on('$destroy', function () {
      unsubscribe();
      if (destroyCollection) {
        destroyCollection();
      }
    });

    $scope.triggerScenario = function (scenario, index) {
      scenario.running = true;
      const defer = $q.defer();
      const scenarioAction = scenario.createdAlertsID ? 'resetScenario' : 'runScenario';
      const playbook = $scope.actionPlaybooks[scenarioAction].playbook;
      if (playbook) {
        defer.resolve(playbook);
      } else {
        const playbookIRI = $scope.actionPlaybooks[scenarioAction].id;
        scenarioSimulatorService.getPlaybook(playbookIRI, CURRENT_MODULE).then(function (response) {
          $scope.actionPlaybooks[scenarioAction].playbook = response.data;
          defer.resolve(response.data);
        }, function () {
          defer.reject();
        });
      }
      defer.promise.then(function (playbook) {
        const actionPlaybook = angular.copy(playbook);
        playbookService.triggerPlaybookAction(actionPlaybook, () => [scenario], $scope, true, entity);
      });
    }

    $scope.getAllSelectedRows = function (row) {
      return [row.entity];
    }

    $scope.getTotalCount = function () {
      return ($scope.scenarioData || []).length;
    };

    $scope.fullRefresh = function () {
      $scope.searchContent();
    }

    $scope.clearSearch = function () {
      $scope.config.searchText = '';
      $scope.searchContent();
    }
    init();

  }
})();
