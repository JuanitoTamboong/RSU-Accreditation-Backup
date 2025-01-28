// Import Firebase modules 
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, onSnapshot, deleteDoc, doc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
import { getStorage, ref, deleteObject } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { getDoc } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js'; // Make sure to import getDoc
import { query, orderBy } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCyVpJ3sr49cWjFMng7ud9LHGCR-xEaptU",
    authDomain: "student-org-backup-51aa3.firebaseapp.com",
    projectId: "student-org-backup-51aa3",
    storageBucket: "student-org-backup-51aa3.firebasestorage.app",
    messagingSenderId: "374718998015",
    appId: "1:374718998015:web:b0f0c15a56c599c25eb3ca"
  };

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);
const storage = getStorage(app);

// Function to render a table row
function renderRow(doc) {
    const {
        emailAddress = 'N/A',
        representativeName = 'N/A',
        organizationName = 'N/A',
        typeOfService = 'N/A',
        dateFiling = 'N/A'
    } = doc.data().applicationDetails || {};

    // Format the date if it's not 'N/A'
    const formattedDateFiling = dateFiling !== 'N/A'
        ? new Date(dateFiling).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'N/A';

    const applicationStatus = doc.data().applicationStatus || 'In-Progress';

    return `
        <tr data-id="${doc.id}">
            <td>${emailAddress}</td>
            <td>${representativeName}</td>
            <td>${typeOfService}</td>
            <td>${organizationName}</td>
            <td>${formattedDateFiling}</td>
            <td>${applicationStatus}</td>
            <td><a href="../admin-dashboard/view-request.html?id=${doc.id}" class="view-link" data-id="${doc.id}">View</a></td>
            <td><button class="delete-btn" data-id="${doc.id}">Delete</button></td>
        </tr>
    `;
}

// Function to delete files from Firebase Storage
async function deleteFiles(fileUrls) {
    const promises = fileUrls.map(async (url) => {
        try {
            // Decode the file path from the URL
            const filePath = decodeURIComponent(new URL(url).pathname.split('/o/')[1]);

            // Create a reference to the file in Firebase Storage
            const fileRef = ref(storage, filePath);

            // Delete the file
            await deleteObject(fileRef);
            console.log(`Deleted file: ${url}`);
        } catch (error) {
            console.error(`Failed to delete file: ${url}`, error);
        }
    });
    return Promise.all(promises);
}

// Function to handle real-time data updates
function fetchApplications() {
    const tableBody = document.getElementById('in-progress-table-body');

    // Query the collection and order by dateFiling in descending order
    const applicationQuery = query(
        collection(db, 'student-org-applications'),
        orderBy('applicationDetails.dateFiling', 'desc') // Order by dateFiling
    );

    onSnapshot(applicationQuery, (snapshot) => {
        tableBody.innerHTML = ''; // Clear the table body before rendering

        if (snapshot.empty) {
            tableBody.innerHTML = '<tr><td colspan="8">No in-progress or pending requests found.</td></tr>';
            return;
        }

        // Filter documents with "in-progress" or "pending" status
        let hasData = false;
        snapshot.forEach((doc) => {
            const applicationStatus = doc.data().applicationStatus || 'in-progress';
            if (applicationStatus === 'in-progress' || applicationStatus === 'Pending') {
                tableBody.innerHTML += renderRow(doc);
                hasData = true;
            }
        });

        // If no matching data is found
        if (!hasData) {
            tableBody.innerHTML = '<tr><td colspan="8">No in-progress or pending requests found.</td></tr>';
        }

        attachDeleteHandlers(); // Attach delete event handlers after rendering rows
    }, (error) => {
        console.error("Error fetching real-time updates:", error);
    });
}
// Function to handle document and associated files deletion
function attachDeleteHandlers() {
    const tableBody = document.getElementById('in-progress-table-body');

    tableBody.addEventListener('click', async (event) => {
        const deleteBtn = event.target.closest('.delete-btn');
        if (!deleteBtn) return;

        const requestId = deleteBtn.getAttribute('data-id');
        console.log("Deleting request ID:", requestId);

        if (!requestId) return;

        const { isConfirmed } = await Swal.fire({
            title: 'Are you sure?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Yes, delete it!',
            customClass: 'swal-pop-up',
        });

        if (!isConfirmed) return;

        try {
            const docRef = doc(db, 'student-org-applications', requestId);
            const docSnapshot = await getDoc(docRef);  // Use getDoc to fetch the document snapshot

            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                const documentUrls = data?.applicationDetails?.documents || [];
                const imageUrls = data?.profiles?.map(profile => profile.imageUrl) || [];

                // Delete associated files
                await deleteFiles([...documentUrls, ...imageUrls]);

                // Delete Firestore document
                await deleteDoc(docRef);

                // Custom success alert
                Swal.fire({
                    title: 'Deleted!',
                    text: 'The request and associated files have been deleted.',
                    icon: 'success',
                    confirmButtonColor: '#3085d6',
                    customClass: 'swal-delete',
                });
            } else {
                throw new Error("Document not found");
            }
        } catch (error) {
            console.error("Error deleting request:", error);
            Swal.fire('Error!', 'Failed to delete the request. Please try again.', 'error');
        }
    });
}

// Initialize when the DOM is loaded
window.addEventListener('DOMContentLoaded', fetchApplications);
