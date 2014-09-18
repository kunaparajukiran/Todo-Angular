/* TodoController - the controller for the "todo view" 
 * relies on Angular injector to provide:
 *     $q - promises manager
 *     $timeout - Angular equivalent of 'setTimeout'
 *     dataservice - the application data access service
 *     logger - the application's logging facility
 */
(function () {

    angular.module('app').controller('TodoController',
    ['$q', '$scope', '$timeout', 'dataservice', 'logger', controller]);

    function controller($q, $scope, $timeout, dataservice, logger) {
        // The controller's API to which the view binds
        var vm = this;
        vm.addItem = addItem;
        vm.archiveCompletedItems = archiveCompletedItems;
        vm.archiveCompletedMessage = archiveCompletedMessage;
        vm.deleteItem = deleteItem;
        vm.editBegin = editBegin;
        vm.editEnd = editEnd;
        vm.getTodos = getTodos;
        vm.includeArchived = false;
        vm.isEditing = isEditing;
        vm.itemFilter = itemFilter;
        vm.itemFilterText = "";
        vm.items = [];
        vm.itemsLeftMessage = itemsLeftMessage;
        vm.newTodoDescription = "";
        vm.purge = purge;
        vm.reset = reset;
        vm.toggleCompleted = toggleCompleted;
        vm.creteCustomer = creteCustomer;
        vm.createOrder = createOrder;
        // Start getting all the todos as soon as this controller is created
        getTodos();

        // Listen for property change of ANY entity so we can (optionally) save
        listenForPropertyChanged();

        /* Implementation */

        var editTodo = null; // the Todo being edited at the moment
        var suspendSave = false;

        function addItem() {
            var description = vm.newTodoDescription;
            if (!description) { return; }

            // Description provided
            var item = dataservice.createTodo({
                Description: description,
                CreatedAt: new Date()
            });

            save(true).catch(addFailed);
            vm.items.push(item);
            vm.newTodoDescription = "";

            function addFailed() {
                removeItem(item); // remove the added item
            }

        };

        function archiveCompletedItems() {
            suspendSave = true;
            var state = getStateOfItems();
            state.itemsDone.forEach(function (item) {
                item.IsArchived = true;
            });
            suspendSave = false;
            save(true).then(filterArchived);

            function filterArchived() {
                if (!vm.includeArchived) {
                    vm.items = vm.items.filter(function (item) {
                        return !item.IsArchived;
                    });
                }
            }
        }

        function archiveCompletedMessage() {
            var count = getStateOfItems().itemsDoneCount;
            if (count > 0) {
                return "Archive " + count + " completed item" + (count > 1 ? "s" : "");
            }
            return null;
        };

        function deleteItem(item) {
            removeItem(item);
            dataservice.deleteTodo(item);
            save(true);
        };

        function editBegin(todoItem) {
            editEnd();
            editTodo = todoItem;
        };

        function editEnd() {
            if (editTodo) {
                editTodo = null;
                save();
            }
        };

        function getTodos() {
            editEnd();
            // wait for Ng binding to set 'includeArchived' flag, then proceed
            $timeout(getTodosImpl, 0);

            function getTodosImpl() {
                dataservice.getTodos(vm.includeArchived)
                    .then(querySucceeded);
            }

            function querySucceeded(data) {
                vm.items = data.results;
                logger.info("Fetched Todos " +
                (vm.includeArchived ? "including archived" : "excluding archived"));
            }
        };

        function getStateOfItems() {
            var itemsDone = [], itemsLeft = [];

            vm.items.forEach(function (item) {
                if (!item.IsArchived) { // only consider the unarchived done items  
                    if (item.IsDone) {
                        itemsDone.push(item);
                    } else {
                        itemsLeft.push(item);
                    }
                }
            });

            vm.allCompleted = itemsLeft.length === 0 && itemsDone.length > 0;

            return {
                itemsDone: itemsDone,
                itemsDoneCount: itemsDone.length,
                itemsLeft: itemsLeft,
                itemsLeftCount: itemsLeft.length
            };
        }

        function isEditing(todoItem) {
            return editTodo === todoItem; // are we editing this one?
        }

        function itemFilter(todoItem) {
            // Beware: this is called a lot!
            var itemFilterText = vm.itemFilterText;
            return itemFilterText ?
                // if there is search text, look for it in the description; else return true
                -1 != todoItem.Description.toLowerCase().indexOf(itemFilterText.toLowerCase()) :
                true;
        };

        function itemsLeftMessage() {
            var count = getStateOfItems().itemsLeftCount;
            if (count > 0) {
                return count + " item" + (count > 1 ? "s" : "") + " left";
            }
            return null;
        };

        function listenForPropertyChanged() {
            // Listen for property change of ANY entity so we can (optionally) save
            var token = dataservice.addPropertyChangeHandler(propertyChanged);

            // Arrange to remove the handler when the controller is destroyed
            // which won't happen in this app but would in a multi-page app
            $scope.$on("$destroy", function () {
                dataservice.removePropertyChangeHandler(token);
            });

            function propertyChanged(changeArgs) {
                // propertyChanged triggers save attempt UNLESS the property is the 'Id'
                // because THEN the change is actually the post-save Id-fixup 
                // rather than user data entry so there is actually nothing to save.
                if (changeArgs.args.propertyName !== 'Id') { save(); }
            }
        }

        function markAllCompleted(value) {
            suspendSave = true;
            vm.items.forEach(function (item) {
                // only set isDone for unarchived items
                !item.IsArchived && (item.IsDone = value);
            });
            suspendSave = false;
            save(true);
        };

        function purge() {
            return dataservice.purge(vm.getTodos);
        };

        function removeItem(item) {
            // remove the item from the list of presented items
            // N.B.: not a delete; it may still exist in cache and the db
            vm.items = vm.items.filter(function (i) {
                return i !== item;
            });
        }

        function reset() {
            return dataservice.reset(vm.getTodos);
        };

        function save(force) {
            // Save if have changes to save AND
            // if must save OR (save not suspended AND not editing a Todo)
            if (dataservice.hasChanges() &&
                (force || (!suspendSave && !editTodo))) {
                return dataservice.saveChanges();
            }
            // Decided not to save; return resolved promise w/ no result
            return $q.when(false);
        }

        function toggleCompleted() {
            // Should toggle to opposite of current 'allCompleted' state
            // Assume that 'allCompleted' databinding hasn't happened yet.
            var toggleValue = !vm.allCompleted;
            markAllCompleted(toggleValue);
        };
        function creteCustomer() {

            var cus = dataservice.creteCustomer({
                CustomerID: 'CERFD',
                CompanyName: 'Alfreds Futterkiste',
                CompanyName: 'Maria Anders',
                ContactName: 'Sales Representative',
                ContactTitle: 'Obere Str. 57',
                Address: 'Berlin',
                City: '',
                Region: '12209',
                PostalCode: 'Germany',
                Phone: '030-0074321',
                Fax: '030-0076545'
            });
            save(true).catch(addFailed1);
            function addFailed1() {
                alert('failed to save data');
            }
        }
        function createOrder() {
            dataservice.getCustomerByID('').then(function (data) {
                var customer = data.results;
                dataservice.createOrder(customer, {
                    //OrderID: '10248',
                    CustomerID: 'CERFD',
                    EmployeeID: '5',
                    OrderDate: '1996-07-04 00:00:00.000',
                    RequiredDate: '1996-08-01 00:00:00.000',
                    ShippedDate: '1996-07-16 00:00:00.000',
                    ShipVia: '3',
                    Freight: '32.38',
                    ShipName: 'Vins et alcools Chevalier',
                    ShipAddress: '59 rue de l Abbaye ',
                    ShipCity: 'Reims',
                    ShipRegion: 'NULL',
                    ShipPostalCode: '51100',
                    ShipCountry: 'France'
                });
            })
           

            //save(true).catch(addFailed1);
            //function addFailed1() {
            //    alert('failed to save data');
            //}
        }
    }
})();