/* Copyright start
  MIT License
  Copyright (c) 2026 Fortinet Inc
  Copyright end */
'use strict';

(function () {
  angular
    .module('cybersponse')
    .factory('scenarioSimulatorService', scenarioSimulatorService);

  scenarioSimulatorService.$inject = ['$http', 'API', 'playbookService', '$q', 'ALL_RECORDS_SIZE'];

  function scenarioSimulatorService($http, API, playbookService, $q, ALL_RECORDS_SIZE) {
    var service;
    service = {
      fetchData: fetchData,
      getPlaybook: getPlaybook
    };

    function fetchData( module, searchText, entityUuid) {
      const payload = {
        sort: [{ field: 'createDate', direction: 'DESC' }],
        logic: 'AND',
        filters: [],
        __selectFields: ['title', 'description', 'createdAlertsID', 'recordTags', 'icon']
      };
        if (entityUuid) {
            payload.filters.push({
                field: 'uuid',
                operator: 'like',
                value: entityUuid,
                type: 'primitive'
            });
        }
      if (searchText) {
        payload.filters.push({
          logic: 'OR',
          filters: [
            { field: 'title', operator: 'like', _operator: 'like', value: `%${searchText}%`, type: 'primitive' },
            { field: 'description', operator: 'like', _operator: 'like', value: `%${searchText}%`, type: 'primitive' },
            { field: 'recordTags', value: [`/api/3/tags/${searchText}`], operator: 'in', type: 'array', OPERATOR_KEY: '$' }
          ]
        });
      }
      return $http.post(API.QUERY + module + `?$limit=${ALL_RECORDS_SIZE}` , payload);
    }

    function getPlaybook(playbookIRI, module) {
      const defer = $q.defer();
      if (playbookService.loadedPlaybookActions && playbookService.loadedPlaybookActions[module]) {
        const playbook = _.find(playbookService.loadedPlaybookActions[module].playbooks, function (pb) {
          return pb['@id'] === playbookIRI;
        });
        if (playbook) {
          defer.resolve({ data: playbook });
          return defer.promise;
        }
      }
      const playbookUUID = $filter('getEndPathName')(playbookIRI);
      $http.get(`${API.BASE}${API.WORKFLOWS}${playbookUUID}?$relationships=true`).then(function (response) {
        defer.resolve(response);
      }, function (error) {
        defer.reject(error);
      });
      return defer.promise;
    }

    return service;
  }
})();
