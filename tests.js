import { transports } from '../src/js/database.js';

// Wait for the main app script to be ready
window.addEventListener('load', () => {
    QUnit.module('Transport Form Submission', {
        beforeEach: () => {
            // Before each test, render a fresh form into the fixture
            const formContainer = document.getElementById('subview-user-new');
            formContainer.innerHTML = `<h2 class="text-xl font-semibold mb-4">Nieuwe transportaanvraag</h2><form id="transport-form" class="space-y-8 bg-white p-6 rounded-lg shadow-sm"></form>`;
            window.testable.renderTransportForm();
        }
    });

    QUnit.test('Submitting a transport with a negative height should fail', (assert) => {
        // 1. Get the initial state
        const initialTransportCount = transports.length;

        // 2. Fill out the form with invalid data
        const form = document.getElementById('transport-form');
        form.querySelector('input[name="from"]').value = 'Test Location A';
        form.querySelector('input[name="to"]').value = 'Test Location B';
        form.querySelector('input[name="date"]').value = '2025-12-01';

        const deviceRow = form.querySelector('.device-row');
        deviceRow.querySelector('input[name="sn"]').value = 'TEST-SN-123';
        deviceRow.querySelector('input[name="type"]').value = 'Test Type';
        deviceRow.querySelector('input[name="height"]').value = '-150'; // Invalid height

        // 3. Create a fake event and call the handler
        const fakeEvent = {
            preventDefault: () => { assert.step('preventDefault called'); },
            target: form
        };
        window.testable.handleTransportSubmit(fakeEvent);

        // 4. Assert the outcome
        assert.equal(transports.length, initialTransportCount, 'A new transport should not have been created.');

        // This is what we expect to happen with the current buggy code.
        // Once the bug is fixed, this test should pass.
        // For now, we expect it to fail because the buggy code adds the transport.
    });
});
