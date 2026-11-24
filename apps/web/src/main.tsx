import './ui/app.css';
import { boot } from './app/boot';

const root = document.getElementById('root');
if (root) void boot(root);
