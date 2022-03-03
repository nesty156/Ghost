import moment from 'moment';
import sinon from 'sinon';
import {authenticateSession} from 'ember-simple-auth/test-support';
import {blur, click, currentURL, fillIn, find, findAll, focus} from '@ember/test-helpers';
import {datepickerSelect} from 'ember-power-datepicker/test-support';
import {enableLabsFlag} from '../../helpers/labs-flag';
import {expect} from 'chai';
import {selectChoose} from 'ember-power-select/test-support/helpers';
import {setupApplicationTest} from 'ember-mocha';
import {setupMirage} from 'ember-cli-mirage/test-support';
import {visit} from '../../helpers/visit';

describe('Acceptance: Members filtering', function () {
    let hooks = setupApplicationTest();
    setupMirage(hooks);

    let clock;

    beforeEach(async function () {
        this.server.loadFixtures('configs');
        this.server.loadFixtures('settings');
        enableLabsFlag(this.server, 'membersLastSeenFilter');
        enableLabsFlag(this.server, 'membersTimeFilters');
        enableLabsFlag(this.server, 'multipleProducts');

        // test with stripe connected and email turned on
        // TODO: add these settings to default fixtures
        this.server.db.settings.find({key: 'stripe_connect_account_id'})
            ? this.server.db.settings.update({key: 'stripe_connect_account_id'}, {value: 'stripe_connected'})
            : this.server.create('setting', {key: 'stripe_connect_account_id', value: 'stripe_connected', group: 'members'});

        this.server.db.settings.find({key: 'editor_default_email_recipients'})
            ? this.server.db.settings.update({key: 'editor_default_email_recipients'}, {value: 'visibility'})
            : this.server.create('setting', {key: 'editor_default_email_recipients', value: 'visibility', group: 'editor'});

        let role = this.server.create('role', {name: 'Owner'});
        this.server.create('user', {roles: [role]});

        return await authenticateSession();
    });

    afterEach(function () {
        clock?.restore();
    });

    it('has a known base-state', async function () {
        this.server.createList('member', 7);

        await visit('/members');

        // members are listed
        expect(find('[data-test-table="members"]')).to.exist;
        expect(findAll('[data-test-list="members-list-item"]').length, '# of member rows').to.equal(7);

        // export is available
        expect(find('[data-test-button="export-members"]'), 'export members button').to.exist;
        expect(find('[data-test-button="export-members"]'), 'export members button').to.not.have.attribute('disabled');

        // bulk actions are hidden
        expect(find('[data-test-button="add-label-selected"]'), 'add label to selected button').to.not.exist;
        expect(find('[data-test-button="remove-label-selected"]'), 'remove label from selected button').to.not.exist;
        expect(find('[data-test-button="unsubscribe-selected"]'), 'unsubscribe selected button').to.not.exist;
        expect(find('[data-test-button="delete-selected"]'), 'delete selected button').to.not.exist;

        // filter and search are inactive
        expect(find('[data-test-input="members-search"]'), 'search input').to.exist;
        expect(find('[data-test-input="members-search"]'), 'search input').to.not.have.class('active');
        expect(find('[data-test-button="members-filter-actions"] span'), 'filter button').to.not.have.class('gh-btn-label-green');

        // standard columns are shown
        expect(findAll('[data-test-table="members"] [data-test-table-column]').length).to.equal(3);
    });

    describe('filtering', function () {
        it('can filter by label', async function () {
            // add some labels to test the selection dropdown
            this.server.createList('label', 4);

            // add a labelled member so we can test the filter includes correctly
            const label = this.server.create('label');
            this.server.createList('member', 3, {labels: [label]});
            // add some non-labelled members so we can see the filter excludes correctly
            this.server.createList('member', 4);

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'label');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // value dropdown can open and has all labels
            await click(`${filterSelector} .gh-member-label-input .ember-basic-dropdown-trigger`);
            expect(findAll(`${filterSelector} [data-test-label-filter]`).length, '# of label options').to.equal(5);

            // selecting a value updates table
            await selectChoose(`${filterSelector} .gh-member-label-input`, label.name);

            expect(findAll('[data-test-list="members-list-item"]').length, `# of filtered member rows - ${label.name}`)
                .to.equal(3);

            // table shows labels column+data
            expect(find('[data-test-table-column="label"]')).to.exist;
            expect(findAll('[data-test-table-data="label"]').length).to.equal(3);
            expect(find('[data-test-table-data="label"]')).to.contain.text(label.name);

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by tier', async function () {
            // add some labels to test the selection dropdown
            this.server.createList('product', 4);

            // add a labelled member so we can test the filter includes correctly
            const product = this.server.create('product');
            this.server.createList('member', 3, {products: [product]});

            // add some non-labelled members so we can see the filter excludes correctly
            this.server.createList('member', 4);

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);
            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'product');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // value dropdown can open and has all labels
            await click(`${filterSelector} .gh-tier-token-input .ember-basic-dropdown-trigger`);
            expect(findAll(`${filterSelector} [data-test-tiers-segment]`).length, '# of label options').to.equal(5);

            // selecting a value updates table
            await selectChoose(`${filterSelector} .gh-tier-token-input`, product.name);

            expect(findAll('[data-test-list="members-list-item"]').length, `# of filtered member rows - ${product.name}`)
                .to.equal(3);
            // table shows labels column+data
            expect(find('[data-test-table-column="product"]')).to.exist;
            expect(findAll('[data-test-table-data="product"]').length).to.equal(3);
            expect(find('[data-test-table-data="product"]')).to.contain.text(product.name);

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by newsletter subscription', async function () {
            // add some members to filter
            this.server.createList('member', 3, {subscribed: true});
            this.server.createList('member', 4, {subscribed: false});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'subscribed');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // has the right values
            const valueOptions = findAll(`${filterSelector} [data-test-select="members-filter-value"] option`);
            expect(valueOptions).to.have.length(2);
            expect(valueOptions[0]).to.have.value('true');
            expect(valueOptions[1]).to.have.value('false');

            // applies default filter immediately
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - true')
                .to.equal(3);

            // can change filter
            await fillIn(`${filterSelector} [data-test-select="members-filter-value"]`, 'false');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - false')
                .to.equal(4);
            expect(find('[data-test-table-column="subscribed"]')).to.exist;

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by member status', async function () {
            // add some members to filter
            this.server.createList('member', 3, {status: 'paid'});
            this.server.createList('member', 4, {status: 'free'});
            this.server.createList('member', 2, {status: 'comped'});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(9);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            expect(
                find(`${filterSelector} [data-test-select="members-filter"] option[value="status"]`),
                'status filter option'
            ).to.exist;
            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'status');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // has the right values
            const valueOptions = findAll(`${filterSelector} [data-test-select="members-filter-value"] option`);
            expect(valueOptions).to.have.length(3);
            expect(valueOptions[0]).to.have.value('paid');
            expect(valueOptions[1]).to.have.value('free');
            expect(valueOptions[2]).to.have.value('comped');

            // applies default filter immediately
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - paid')
                .to.equal(3);

            // can change filter
            await fillIn(`${filterSelector} [data-test-select="members-filter-value"]`, 'comped');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - comped')
                .to.equal(2);
            expect(find('[data-test-table-column="status"]')).to.exist;

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(9);
        });

        it('can filter by billing period', async function () {
            // add some members to filter
            this.server.createList('member', 3, {subscriptions: [{plan_interval: 'month'}]});
            this.server.createList('member', 4, {subscriptions: [{plan_interval: 'year'}]});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'subscriptions.plan_interval');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // has the right values
            const valueOptions = findAll(`${filterSelector} [data-test-select="members-filter-value"] option`);
            expect(valueOptions).to.have.length(2);
            expect(valueOptions[0]).to.have.value('month');
            expect(valueOptions[1]).to.have.value('year');

            // applies default filter immediately
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - month')
                .to.equal(3);

            // can change filter
            await fillIn(`${filterSelector} [data-test-select="members-filter-value"]`, 'year');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - year')
                .to.equal(4);
            expect(find('[data-test-table-column="subscriptions.plan_interval"]')).to.exist;

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by stripe subscription status', async function () {
            // add some members to filter
            this.server.createList('member', 3, {subscriptions: [{status: 'active'}]});
            this.server.createList('member', 4, {subscriptions: [{status: 'trialing'}]});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'subscriptions.status');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-not');

            // has the right values
            const valueOptions = findAll(`${filterSelector} [data-test-select="members-filter-value"] option`);
            expect(valueOptions).to.have.length(7);
            expect(valueOptions[0]).to.have.value('active');
            expect(valueOptions[1]).to.have.value('trialing');
            expect(valueOptions[2]).to.have.value('canceled');
            expect(valueOptions[3]).to.have.value('unpaid');
            expect(valueOptions[4]).to.have.value('past_due');
            expect(valueOptions[5]).to.have.value('incomplete');
            expect(valueOptions[6]).to.have.value('incomplete_expired');

            // applies default filter immediately
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - active')
                .to.equal(3);

            // can change filter
            await fillIn(`${filterSelector} [data-test-select="members-filter-value"]`, 'trialing');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - trialing')
                .to.equal(4);
            expect(find('[data-test-table-column="subscriptions.status"]')).to.exist;

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by emails sent', async function () {
            // add some members to filter
            this.server.createList('member', 3, {emailCount: 5});
            this.server.createList('member', 4, {emailCount: 10});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'email_count');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(3);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-greater');
            expect(operatorOptions[2]).to.have.value('is-less');

            const valueInput = `${filterSelector} [data-test-input="members-filter-value"]`;

            // has no default filter
            expect(find(valueInput)).to.have.value('');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - true')
                .to.equal(7);

            // can focus/blur value input without issue
            await focus(valueInput);
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - true')
                .to.equal(7);

            // can change filter
            await fillIn(valueInput, '5');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - false')
                .to.equal(3);
            expect(find('[data-test-table-column="email_count"]')).to.exist;

            // can clear filter
            await fillIn(valueInput, '');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - false')
                .to.equal(7);

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows')
                .to.equal(7);
        });

        it('can filter by emails opened', async function () {
            // add some members to filter
            this.server.createList('member', 3, {emailOpenedCount: 5});
            this.server.createList('member', 4, {emailOpenedCount: 10});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'email_opened_count');

            // has the right operators
            const operatorOptions = findAll(`${filterSelector} [data-test-select="members-filter-operator"] option`);
            expect(operatorOptions).to.have.length(3);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-greater');
            expect(operatorOptions[2]).to.have.value('is-less');

            const valueInput = `${filterSelector} [data-test-input="members-filter-value"]`;

            // has no default filter
            expect(find(valueInput)).to.have.value('');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(7);

            // can focus/blur value input without issue
            await focus(valueInput);
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - after blur')
                .to.equal(7);

            // can change filter
            await fillIn(valueInput, '5');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - input 5')
                .to.equal(3);
            expect(find('[data-test-table-column="email_opened_count"]')).to.exist;

            // can clear filter
            await fillIn(valueInput, '');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - cleared')
                .to.equal(7);

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by open rate', async function () {
            // add some members to filter
            this.server.createList('member', 3, {emailOpenRate: 50});
            this.server.createList('member', 4, {emailOpenRate: 100});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'email_open_rate');

            const operatorSelector = `${filterSelector} [data-test-select="members-filter-operator"]`;

            // has the right operators
            const operatorOptions = findAll(`${operatorSelector} option`);
            expect(operatorOptions).to.have.length(3);
            expect(operatorOptions[0]).to.have.value('is');
            expect(operatorOptions[1]).to.have.value('is-greater');
            expect(operatorOptions[2]).to.have.value('is-less');

            const valueInput = `${filterSelector} [data-test-input="members-filter-value"]`;

            // has no default filter
            expect(find(valueInput)).to.have.value('');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(7);

            // can focus/blur value input without issue
            await focus(valueInput);
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - after blur')
                .to.equal(7);

            // can change filter
            await fillIn(valueInput, '50');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - value 50')
                .to.equal(3);
            expect(find('[data-test-table-column="email_open_rate"]')).to.exist;

            // can change operator
            await fillIn(operatorSelector, 'is-greater');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - operator is-greater')
                .to.equal(4);

            // can clear filter
            await fillIn(valueInput, '');
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - cleared')
                .to.equal(7);

            // can delete filter
            await click('[data-test-delete-members-filter="0"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows after delete')
                .to.equal(7);
        });

        it('can filter by last seen date', async function () {
            clock = sinon.useFakeTimers({
                now: moment('2022-02-10 11:50:00.000Z').toDate(),
                shouldAdvanceTime: true
            });

            // add some members to filter
            this.server.createList('member', 3, {lastSeenAt: moment('2022-02-01 12:00:00').format('YYYY-MM-DD HH:mm:ss')});
            this.server.createList('member', 4, {lastSeenAt: moment('2022-02-05 12:00:00').format('YYYY-MM-DD HH:mm:ss')});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelector = `[data-test-members-filter="0"]`;

            await fillIn(`${filterSelector} [data-test-select="members-filter"]`, 'last_seen_at');

            const operatorSelector = `${filterSelector} [data-test-select="members-filter-operator"]`;

            // has the right operators
            const operatorOptions = findAll(`${operatorSelector} option`);
            expect(operatorOptions).to.have.length(2);
            expect(operatorOptions[0]).to.have.value('is-less');
            expect(operatorOptions[1]).to.have.value('is-greater');

            const valueInput = `${filterSelector} [data-test-input="members-filter-value"]`;

            // has no default filter
            expect(find(valueInput)).to.have.value('');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(7);

            // can focus/blur value input without issue
            await focus(valueInput);
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - after blur')
                .to.equal(7);

            // can change filter
            await fillIn(valueInput, '2'); // last seen less than 2 days ago
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen less than 2 days ago')
                .to.equal(0);

            await fillIn(valueInput, '6'); // last seen less than 6 days ago
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen less than 6 days ago')
                .to.equal(4);

            // table shows last seen column+data
            expect(find('[data-test-table-column="last_seen_at"]')).to.exist;
            expect(findAll('[data-test-table-data="last_seen_at"]').length).to.equal(4);
            expect(find('[data-test-table-data="last_seen_at"]')).to.contain.text('5 Feb 2022');
            expect(find('[data-test-table-data="last_seen_at"]')).to.contain.text('5 days ago');

            await fillIn(valueInput, '11'); // last seen less than 11 days ago
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen less than 11 days ago')
                .to.equal(7);

            // can change operator
            await fillIn(operatorSelector, 'is-greater');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen more than 11 days ago')
                .to.equal(0);

            await fillIn(valueInput, '6'); // last seen more than 6 days ago
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen more than 6 days ago')
                .to.equal(3);

            await fillIn(valueInput, '2'); // last seen more than 2 days ago
            await blur(valueInput);
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - last seen more than 2 days ago')
                .to.equal(7);
        });

        it('can filter by created at date', async function () {
            clock = sinon.useFakeTimers({
                now: moment('2022-03-01 09:00:00.000Z').toDate(),
                shouldAdvanceTime: true
            });

            // add some members to filter
            this.server.createList('member', 3, {createdAt: moment('2022-02-01 12:00:00').format('YYYY-MM-DD HH:mm:ss')});
            this.server.createList('member', 4, {createdAt: moment('2022-02-05 12:00:00').format('YYYY-MM-DD HH:mm:ss')});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filterSelect = `[data-test-members-filter="0"]`;
            const typeSelect = `${filterSelect} [data-test-select="members-filter"]`;
            const operatorSelect = `${filterSelect} [data-test-select="members-filter-operator"]`;

            expect(find(`${filterSelect} [data-test-select="members-filter"] option[value="created_at"]`), 'created_at filter option').to.exist;

            await fillIn(typeSelect, 'created_at');

            // has the right operators
            const operatorOptions = findAll(`${operatorSelect} option`);
            expect(operatorOptions).to.have.length(4);
            expect(operatorOptions[0]).to.have.value('is-less');
            expect(operatorOptions[1]).to.have.value('is-or-less');
            // expect(operatorOptions[2]).to.have.value('is');
            // expect(operatorOptions[3]).to.have.value('is-not');
            expect(operatorOptions[2]).to.have.value('is-greater');
            expect(operatorOptions[3]).to.have.value('is-or-greater');

            const valueDateInput = `${filterSelect} [data-test-input="members-filter-value"] [data-test-date-picker-input]`;
            const valueDatePicker = `${filterSelect} [data-test-input="members-filter-value"]`;

            // operator defaults to before
            expect(find(operatorSelect)).to.have.value('is-less');

            // value defaults to today's date
            expect(find(valueDateInput)).to.have.value('2022-03-01');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(7);

            // can change date
            await datepickerSelect(valueDatePicker, moment.utc('2022-02-03').toDate());
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(3);

            // can change operator
            await fillIn(operatorSelect, 'is-greater');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - default')
                .to.equal(4);

            // can populate filter from URL
            // TODO: leaving screen is needed, suggests component is not fully reactive and needs to be torn down.
            // - see <Members::Filter> constructor
            await visit(`/`);
            const filter = encodeURIComponent(`created_at:<='2022-02-01 23:59:59'`);
            await visit(`/members?filter=${filter}`);
            await click('[data-test-button="members-filter-actions"]');

            expect(find(typeSelect), 'type select - from URL').to.have.value('created_at');
            expect(find(operatorSelect), 'operator select - from URL').to.have.value('is-or-less');
            expect(find(valueDateInput), 'date input - from URL').to.have.value('2022-02-01');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - from URL')
                .to.equal(3);

            // "on or after" doesn't break
            await fillIn(operatorSelect, 'is-or-greater');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of filtered member rows - from URL')
                .to.equal(7);

            // it does not add extra column to table
            expect(find('[data-test-table-column="created_at"]')).to.not.exist;
        });

        it('uses site timezone when filtering by date', async function () {
            // with a site timezone UTC-5 (Eastern Time Zone) we would expect date-based NQL filter strings
            // to be adjusted to UTC.
            //
            // Eg. "created on or after 2022-02-22" = `created_at:>='2022-02-22 05:00:00'
            //
            // we also need to convert back when parsing the NQL-based query param and make sure dates
            // shown in the members table match site timezone

            // UTC-5 timezone
            this.server.db.settings.update({key: 'timezone'}, {value: 'America/New_York'});

            // 2022-02-21 signups
            this.server.createList('member', 3, {createdAt: moment.utc('2022-02-22 04:00:00.000Z').format('YYYY-MM-DD HH:mm:ss')});
            // 2022-02-22 signups
            this.server.createList('member', 4, {createdAt: moment.utc('2022-02-22 05:00:00.000Z').format('YYYY-MM-DD HH:mm:ss')});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            // created dates in table should match the date in site timezone not UTC (in UTC they would all be 21st)
            const createdAtFields = findAll('[data-test-list="members-list-item"] [data-test-table-data="created-at"]');
            expect(createdAtFields.filter(el => el.textContent.match(/21 Feb 2022/)).length).to.equal(3);
            expect(createdAtFields.filter(el => el.textContent.match(/22 Feb 2022/)).length).to.equal(4);

            const filterSelect = `[data-test-members-filter="0"]`;
            const typeSelect = `${filterSelect} [data-test-select="members-filter"]`;
            const operatorSelect = `${filterSelect} [data-test-select="members-filter-operator"]`;
            const valueInput = `${filterSelect} [data-test-input="members-filter-value"] [data-test-date-picker-input]`;

            // filter date is transformed to UTC equivalent timeframe when querying
            await click('[data-test-button="members-filter-actions"]');
            await fillIn(typeSelect, 'created_at');
            await fillIn(operatorSelect, 'is-or-greater');
            await fillIn(valueInput, '2022-02-22');
            await blur(valueInput);

            expect(findAll('[data-test-list="members-list-item"]').length, '# of member rows - post filter')
                .to.equal(4);

            // query param is transformed back to expected filter date value
            await visit('/'); // TODO: remove once <Members::Filter> component reacts to filter updates
            const filterQuery = encodeURIComponent(`created_at:<='2022-02-22 04:59:59'`);
            await visit(`/members?filter=${filterQuery}`);

            expect(findAll('[data-test-list="members-list-item"]').length, '# of member rows - post URL parse')
                .to.equal(3);

            await click('[data-test-button="members-filter-actions"]');

            expect(find(operatorSelect)).to.have.value('is-or-less');
            expect(find(valueInput)).to.have.value('2022-02-21');

            // it initializes date filter with correct site timezone date
            // "local" is 1st March 04:00 but site time is 28th Feb 00:00
            clock = sinon.useFakeTimers({
                now: moment('2022-03-01 04:00:00.000Z').toDate(),
                shouldAdvanceTime: true
            });

            await click('[data-test-delete-members-filter="0"]');
            await click('[data-test-button="members-filter-actions"]');
            await fillIn(typeSelect, 'created_at');

            expect(find(valueInput)).to.have.value('2022-02-28');
        });

        it('can handle multiple filters', async function () {
            // add some members to filter
            this.server.createList('member', 1, {subscriptions: [{status: 'active'}]});
            this.server.createList('member', 2, {subscriptions: [{status: 'trialing'}]});
            this.server.createList('member', 3, {emailOpenRate: 50, subscriptions: [{status: 'trialing'}]});
            this.server.createList('member', 4, {emailOpenRate: 100});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(10);

            await click('[data-test-button="members-filter-actions"]');

            await fillIn('[data-test-members-filter="0"] [data-test-select="members-filter"]', 'email_open_rate');
            await fillIn('[data-test-members-filter="0"] [data-test-input="members-filter-value"]', '50');
            await blur('[data-test-members-filter="0"] [data-test-input="members-filter-value"]');

            await click('[data-test-button="add-members-filter"]');

            await fillIn(`[data-test-members-filter="1"] [data-test-select="members-filter"]`, 'subscriptions.status');
            await fillIn(`[data-test-members-filter="1"] [data-test-select="members-filter-value"]`, 'trialing');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of members rows after filter')
                .to.equal(3);

            await click('[data-test-button="members-apply-filter"]');

            // all filtered columns are shown
            expect(find('[data-test-table-column="email_open_rate"]')).to.exist;
            expect(find('[data-test-table-column="subscriptions.status"]')).to.exist;

            // bulk actions are shown
            expect(find('[data-test-button="add-label-selected"]'), 'add label to selected button').to.exist;
            expect(find('[data-test-button="remove-label-selected"]'), 'remove label from selected button').to.exist;
            expect(find('[data-test-button="unsubscribe-selected"]'), 'unsubscribe selected button').to.exist;
            expect(find('[data-test-button="delete-selected"]'), 'delete selected button').to.exist;

            // filter is active and has # of filters
            expect(find('[data-test-button="members-filter-actions"] span'), 'filter button').to.have.class('gh-btn-label-green');
            expect(find('[data-test-button="members-filter-actions"]'), 'filter button').to.contain.text('(2)');

            // search is inactive
            expect(find('[data-test-input="members-search"]'), 'search input').to.exist;
            expect(find('[data-test-input="members-search"]'), 'search input').to.not.have.class('active');

            // can reset filter
            await click('[data-test-button="members-filter-actions"]');
            await click('[data-test-button="reset-members-filter"]');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(10);

            // filter is inactive
            expect(find('[data-test-button="members-filter-actions"] span'), 'filter button').to.not.have.class('gh-btn-label-green');
        });

        it('has a no-match state', async function () {
            this.server.createList('member', 5, {subscriptions: [{status: 'active'}]});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(5);

            await click('[data-test-button="members-filter-actions"]');

            await fillIn('[data-test-members-filter="0"] [data-test-select="members-filter"]', 'email_open_rate');
            await fillIn('[data-test-members-filter="0"] [data-test-input="members-filter-value"]', '50');
            await blur('[data-test-members-filter="0"] [data-test-input="members-filter-value"]');

            await click('[data-test-button="members-apply-filter"]');

            // replaces members table with the no-matching members state
            expect(find('[data-test-table="members"]')).to.not.exist;
            expect(find('[data-test-no-matching-members]')).to.exist;

            // search input is hidden
            expect(find('[data-test-input="members-search"]')).to.not.be.visible;

            // export is disabled
            expect(find('[data-test-button="export-members"]')).to.have.attribute('disabled');

            // bulk actions are hidden
            expect(find('[data-test-button="add-label-selected"]')).to.not.exist;
            expect(find('[data-test-button="remove-label-selected"]')).to.not.exist;
            expect(find('[data-test-button="unsubscribe-selected"]')).to.not.exist;
            expect(find('[data-test-button="delete-selected"]')).to.not.exist;

            // can clear the filter
            await click('[data-test-no-matching-members] [data-test-button="show-all-members"]');

            expect(currentURL()).to.equal('/members');
            expect(find('[data-test-button="members-filter-actions"] span'), 'filter button').to.not.have.class('gh-btn-label-green');
        });

        it('resets filter operator when changing filter type', async function () {
            // BUG: changing the filter type was not resetting the filter operator
            // meaning you could have an "is-greater" operator applied to an
            // "is/is-not" filter type

            this.server.createList('member', 3, {subscriptions: [{status: 'active'}]});
            this.server.createList('member', 4, {emailCount: 10});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(7);

            await click('[data-test-button="members-filter-actions"]');

            const filter = '[data-test-members-filter="0"]';

            await fillIn(`${filter} [data-test-select="members-filter"]`, 'email_count');
            await fillIn(`${filter} [data-test-select="members-filter-operator"]`, 'is-greater');
            await fillIn(`${filter} [data-test-input="members-filter-value"]`, '9');
            await blur(`${filter} [data-test-input="members-filter-value"]`);

            expect(findAll('[data-test-list="members-list-item"]').length, '# of members after email_count filter')
                .to.equal(4);

            await fillIn(`${filter} [data-test-select="members-filter"]`, 'subscriptions.status');

            expect(find(`${filter} [data-test-select="members-filter-operator"]`)).to.have.value('is');
            expect(findAll('[data-test-list="members-list-item"]').length, '# of members after email_count filter')
                .to.equal(3);
        });

        it('hides paid filters when stripe isn\'t connected', async function () {
            // disconnect stripe
            this.server.db.settings.update({key: 'stripe_connect_account_id'}, {value: null});
            this.server.createList('member', 10);

            await visit('/members');
            await click('[data-test-button="members-filter-actions"]');

            expect(
                find('[data-test-members-filter="0"] [data-test-select="members-filter"] optgroup[label="Subscription"]'),
                'Subscription option group doesn\'t exist'
            ).to.not.exist;

            const filterOptions = findAll('[data-test-members-filter="0"] [data-test-select="members-filter"] option')
                .map(option => option.value);

            expect(filterOptions).to.not.include('status');
            expect(filterOptions).to.not.include('subscriptions.plan_interval');
            expect(filterOptions).to.not.include('subscriptions.status');
        });

        it('hides email filters when email is disabled', async function () {
            // disable email
            this.server.db.settings.update({key: 'editor_default_email_recipients'}, {value: 'disabled'});
            this.server.createList('member', 10);

            await visit('/members');
            await click('[data-test-button="members-filter-actions"]');

            expect(
                find('[data-test-members-filter="0"] [data-test-select="members-filter"] optgroup[label="Email"]'),
                'Email option group doesn\'t exist'
            ).to.not.exist;

            const filterOptions = findAll('[data-test-members-filter="0"] [data-test-select="members-filter"] option')
                .map(option => option.value);

            expect(filterOptions).to.not.include('email_count');
            expect(filterOptions).to.not.include('email_opened_count');
            expect(filterOptions).to.not.include('email_open_rate');
        });
    });

    describe('search', function () {
        beforeEach(function () {
            // specific member names+emails so search is deterministic
            // (default factory has random names+emails)
            this.server.create('member', {name: 'X', email: 'x@x.xxx'});
            this.server.create('member', {name: 'Y', email: 'y@y.yyy'});
            this.server.create('member', {name: 'Z', email: 'z@z.zzz'});
        });

        it('works', async function () {
            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(3);

            await fillIn('[data-test-input="members-search"]', 'X');

            // list updates
            expect(findAll('[data-test-list="members-list-item"]').length, '# of members matching "X"')
                .to.equal(1);

            // URL reflects search
            expect(currentURL()).to.equal('/members?search=X');

            // search input is active
            expect(find('[data-test-input="members-search"]')).to.have.class('active');

            // bulk actions become available
            expect(find('[data-test-button="add-label-selected"]'), 'add label to selected button').to.exist;
            expect(find('[data-test-button="remove-label-selected"]'), 'remove label from selected button').to.exist;
            expect(find('[data-test-button="unsubscribe-selected"]'), 'unsubscribe selected button').to.exist;
            expect(find('[data-test-button="delete-selected"]'), 'delete selected button').to.exist;

            // clearing search returns us to starting state
            await fillIn('[data-test-input="members-search"]', '');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of members after clearing search')
                .to.equal(3);

            expect(find('[data-test-input="members-search"]')).to.not.have.class('active');
        });

        it('populates from query param', async function () {
            await visit('/members?search=Y');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(1);

            expect(find('[data-test-input="members-search"]')).to.have.value('Y');
            expect(find('[data-test-input="members-search"]')).to.have.class('active');
        });

        it('has a no-match state', async function () {
            await visit('/members');
            await fillIn('[data-test-input="members-search"]', 'unknown');

            expect(currentURL()).to.equal('/members?search=unknown');

            // replaces members table with the no-matching members state
            expect(find('[data-test-table="members"]')).to.not.exist;
            expect(find('[data-test-no-matching-members]')).to.exist;

            // search input is still shown
            expect(find('[data-test-input="members-search"]')).to.be.visible;
            expect(find('[data-test-input="members-search"]')).to.have.class('active');

            // export is disabled
            expect(find('[data-test-button="export-members"]')).to.have.attribute('disabled');

            // bulk actions are hidden
            expect(find('[data-test-button="add-label-selected"]')).to.not.exist;
            expect(find('[data-test-button="remove-label-selected"]')).to.not.exist;
            expect(find('[data-test-button="unsubscribe-selected"]')).to.not.exist;
            expect(find('[data-test-button="delete-selected"]')).to.not.exist;

            // can clear the search
            await click('[data-test-no-matching-members] [data-test-button="show-all-members"]');

            expect(currentURL()).to.equal('/members');
            expect(find('[data-test-input="members-search"]')).to.have.value('');
            expect(find('[data-test-input="members-search"]')).to.not.have.class('active');
            expect(findAll('[data-test-list="members-list-item"]').length).to.equal(3);
        });

        it('can search + filter', async function () {
            this.server.create('member', {name: 'A', email: 'a@aaa.aaa', subscriptions: [{status: 'active'}]});

            await visit('/members');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of initial member rows')
                .to.equal(4);

            await click('[data-test-button="members-filter-actions"]');
            await fillIn('[data-test-members-filter="0"] [data-test-select="members-filter"]', 'subscriptions.status');
            await fillIn('[data-test-members-filter="0"] [data-test-select="members-filter-value"]', 'active');
            await click('[data-test-button="members-apply-filter"]');

            await fillIn('[data-test-input="members-search"]', 'a');

            expect(findAll('[data-test-list="members-list-item"]').length, '# of member rows after filter+search')
                .to.equal(1);

            // filter is active and has # of filters
            expect(find('[data-test-button="members-filter-actions"] span'), 'filter button').to.have.class('gh-btn-label-green');
            expect(find('[data-test-button="members-filter-actions"]'), 'filter button').to.contain.text('(1)');

            // search input is active
            expect(find('[data-test-input="members-search"]')).to.have.class('active');
        });
    });
});
