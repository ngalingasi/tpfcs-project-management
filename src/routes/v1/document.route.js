const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const documentController = require('../../controllers/document.controller');
const upload = require('../../middlewares/upload');

router.route('/:documentId')
  .get(auth(), documentController.getDocument)
  .patch(auth(), documentController.updateDocument)
  .delete(auth(), documentController.deleteDocument); // permission depends on the document, checked in the controller

router.post('/:documentId/versions', auth(), upload.single('file'), documentController.uploadNewVersion);
router.get('/:documentId/download/:version?', auth(), documentController.downloadDocument);

// Comments on general (project-level) documents
router.route('/:documentId/comments')
  .get(auth('getProjects'), documentController.getComments)
  .post(auth('getProjects'), documentController.addComment);
router.delete('/:documentId/comments/:commentId', auth('getProjects'), documentController.deleteComment);

module.exports = router;
