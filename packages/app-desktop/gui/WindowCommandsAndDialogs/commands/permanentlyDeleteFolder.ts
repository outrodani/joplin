import { CommandRuntime, CommandDeclaration, CommandContext } from '@joplin/lib/services/CommandService';
import { _ } from '@joplin/lib/locale';
import bridge from '../../../services/bridge';
import Folder from '@joplin/lib/models/Folder';
import Note from '@joplin/lib/models/Note';

const { substrWithEllipsis } = require('@joplin/lib/string-utils');

export const declaration: CommandDeclaration = {
	name: 'permanentlyDeleteFolder',
	label: () => _('Permanently delete notebook'),
};

export const runtime = (): CommandRuntime => {
	return {
		execute: async (context: CommandContext, folderId: string = null) => {
			if (folderId === null) folderId = context.state.selectedFolderId;

			const folder = await Folder.load(folderId);
			if (!folder) throw new Error(`No such folder: ${folderId}`);

			let deleteMessage = _('Permanently delete notebook "%s"?\n\nAll notes and sub-notebooks within this notebook will also be permanently deleted.', substrWithEllipsis(folder.title, 0, 32));
			if (folderId === context.state.settings['sync.10.inboxId']) {
				deleteMessage = _('Delete the Inbox notebook?\n\nIf you delete the inbox notebook, any email that\'s recently been sent to it may be lost.');
			}

			const ok = bridge().showConfirmMessageBox(deleteMessage);
			if (!ok) return;

			// looks for notes in the trash whose parent_id is the folderId and deletes them
			const notesInTrash = await Note.modelSelectAll('SELECT id FROM notes WHERE parent_id = ? AND deleted_time > 0', [folderId]);
			const noteIds = notesInTrash.map(n => n.id);
			if (noteIds.length) {
				await Note.batchDelete(noteIds, { toTrash: false, sourceDescription: 'permanentlyDeleteFolder/notes' });
			}

			// deletes the folder itself
			await Folder.delete(folderId, {
				toTrash: false,
				deleteChildren: false,
				sourceDescription: 'permanentlyDeleteFolder command',
			});
		},
		// enabledCondition: '(!folderIsReadOnly || inTrash)',
		// enabledCondition: 'folderIsDeleted',
	};
};
